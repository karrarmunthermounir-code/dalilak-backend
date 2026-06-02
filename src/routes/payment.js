const express = require('express');
const jwt_zaincash = require('jsonwebtoken');

const router = express.Router(); // mounted at /api/payment

// ════════════════════════════════════════════════
// ZainCash Config
// ════════════════════════════════════════════════
const ZAINCASH_MODE = (process.env.ZAINCASH_MODE || '').toLowerCase();
const IS_PRODUCTION = ZAINCASH_MODE === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dalilak-frontend.onrender.com';

// ─── URL ذكي: لو ZAINCASH_API_URL يحوي مسار كامل (transaction/init) نأخذه كما هو،
//     وإلا نعامله كـ base URL ونضيف المسارات الرسمية ───
function resolveZainCashUrls(envUrl) {
  const defaultBase = IS_PRODUCTION
    ? 'https://api.zaincash.iq'
    : 'https://test.zaincash.iq';

  const raw = (envUrl || '').trim().replace(/\/+$/, '');
  if (!raw) {
    return { API_URL: `${defaultBase}/transaction/init`, PAY_URL: `${defaultBase}/transaction/pay` };
  }

  // المستخدم وضع مسار كامل ينتهي بـ /transaction/init أو ما شابه
  if (/\/transaction\/init$/i.test(raw)) {
    return { API_URL: raw, PAY_URL: raw.replace(/\/transaction\/init$/i, '/transaction/pay') };
  }
  // مسار v2: /api/v2/payment-gateway/transaction/init
  if (/\/payment-gateway\/transaction\/init$/i.test(raw)) {
    return { API_URL: raw, PAY_URL: raw.replace(/\/transaction\/init$/i, '/transaction/pay') };
  }

  // base URL فقط — نضيف المسارات
  return { API_URL: `${raw}/transaction/init`, PAY_URL: `${raw}/transaction/pay` };
}

const { API_URL: ZC_API_URL, PAY_URL: ZC_PAY_URL } = resolveZainCashUrls(process.env.ZAINCASH_API_URL);

const ZAINCASH = {
  MSISDN:      process.env.ZAINCASH_MSISDN     || '',
  MERCHANT_ID: process.env.ZAINCASH_MERCHANT_ID || '',
  SECRET_KEY:  process.env.ZAINCASH_API_KEY     || '',
  SERVICE:     process.env.ZAINCASH_SERVICE     || 'دليلك - اشتراك',
  REDIRECT:    process.env.ZAINCASH_REDIRECT    || `${process.env.BACKEND_URL || 'https://dalilak-api.onrender.com'}/api/payment/callback`,
  API_URL:     ZC_API_URL,
  PAY_URL:     ZC_PAY_URL,
};

// ─── ZainCash production-only: لا fallback إطلاقاً ───
//   إذا ZAINCASH_MODE !== 'production' أو أي من (MERCHANT_ID / API_KEY / MSISDN) فارغ
//   → /zaincash/init يرجع 503 صريح. لا Demo mode، لا تفعيل بدون دفع.
const MISSING_CREDS = [];
if (!ZAINCASH.MERCHANT_ID) MISSING_CREDS.push('ZAINCASH_MERCHANT_ID');
if (!ZAINCASH.SECRET_KEY)  MISSING_CREDS.push('ZAINCASH_API_KEY');
if (!ZAINCASH.MSISDN)      MISSING_CREDS.push('ZAINCASH_MSISDN');
const CREDS_OK     = MISSING_CREDS.length === 0;
const IS_CONFIGURED = IS_PRODUCTION && CREDS_OK;

console.log(
  `[ZainCash] mode=${IS_CONFIGURED ? 'PRODUCTION' : 'MISCONFIGURED'} ` +
  `(ZAINCASH_MODE="${ZAINCASH_MODE || '(unset)'}", credsOK=${CREDS_OK}) ` +
  `apiUrl=${ZAINCASH.API_URL}`
);
if (!IS_CONFIGURED) {
  if (!IS_PRODUCTION) {
    console.error(`[ZainCash] ❌ ZAINCASH_MODE != "production" (current="${ZAINCASH_MODE || '(unset)'}") — /zaincash/init will reject all requests.`);
  }
  if (MISSING_CREDS.length) {
    console.error(`[ZainCash] ❌ Missing env vars: ${MISSING_CREDS.join(', ')}`);
  }
}

const PLANS = {
  free_trial: { id: 'free_trial', name: 'تجربة مجانية', price: 0, days: 30 },
  monthly: { id: 'monthly_pro', name: 'شهري',  price: 65000,  days: 30  },
  yearly:  { id: 'premium',     name: 'سنوي', price: 325000, days: 365 },
};

// ─── مخازن مؤقتة للطلبات (يمكن استبدالها بـ MongoDB لاحقاً) ───
const pendingOrders = new Map();
// ─── طلبات مدفوعة بانتظار التفعيل (ينتقل إليها الـ orderId بعد نجاح ZainCash callback) ───
// activateSubscription يتحقق من وجود orderId هنا قبل التفعيل، ثم يحذفه (استهلاك مرة واحدة)
const paidOrders = new Map();
// تنظيف الطلبات المدفوعة الأقدم من ساعة (حماية من نمو ذاكرة غير محدود)
const PAID_ORDER_TTL_MS = 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [orderId, order] of paidOrders.entries()) {
    if (now - new Date(order.paidAt).getTime() > PAID_ORDER_TTL_MS) {
      paidOrders.delete(orderId);
    }
  }
}, 10 * 60 * 1000).unref?.();

// ════════════════════════════════════════════════
// 1. إنشاء طلب دفع ZainCash — POST /api/payment/zaincash/init
// ════════════════════════════════════════════════
router.post('/zaincash/init', async (req, res) => {
  try {
    // ─── Guard: لا تفعيل دفع إذا ZainCash غير مهيأ ───
    if (!IS_CONFIGURED) {
      console.error(`[ZainCash] init rejected — misconfigured. missing=${MISSING_CREDS.join(',') || 'none'} mode="${ZAINCASH_MODE}"`);
      return res.status(503).json({
        success: false,
        error: 'ZainCash غير مهيأ — اتصل بالدعم',
        misconfigured: true,
      });
    }

    const { planId, name, phone, email } = req.body;
    const planKey = planId === 'monthly_pro' || planId === 'monthly' ? 'monthly' : 'yearly';
    const plan = PLANS[planKey];

    if (!plan) return res.status(400).json({ success: false, error: 'خطة غير صحيحة' });

    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    pendingOrders.set(orderId, {
      orderId, planId: plan.id, planName: plan.name,
      plan, name, phone, email,
      createdAt: new Date().toISOString(),
    });

    // ─── ZainCash حقيقي (Production) ───
    // ملاحظة: msisdn في الـ payload هو رقم التاجر المسجل لدى ZainCash (ZAINCASH_MSISDN)
    const payload = {
      amount:      plan.price,
      serviceType: ZAINCASH.SERVICE,
      msisdn:      ZAINCASH.MSISDN,
      orderId,
      redirectUrl: ZAINCASH.REDIRECT,
      iat:  Math.floor(Date.now() / 1000),
      exp:  Math.floor(Date.now() / 1000) + 60 * 60 * 4, // 4 ساعات صلاحية
    };

    const token = jwt_zaincash.sign(payload, ZAINCASH.SECRET_KEY, { algorithm: 'HS256' });

    console.log(`[ZainCash] init order=${orderId} amount=${plan.price} → ${ZAINCASH.API_URL}`);

    const response = await fetch(ZAINCASH.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, merchantId: ZAINCASH.MERCHANT_ID, lang: 'ar' }).toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (data.id) {
      console.log(`[ZainCash] ✅ transaction created id=${data.id} order=${orderId}`);
      return res.json({ success: true, payUrl: `${ZAINCASH.PAY_URL}?id=${data.id}`, orderId });
    }
    if (data.payUrl) {
      return res.json({ success: true, payUrl: data.payUrl, orderId });
    }
    console.error('[ZainCash] init failed response:', data);
    throw new Error(data.err?.msg || data.msg || 'فشل إنشاء طلب ZainCash');
  } catch (err) {
    console.error('ZainCash init error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════
// 2. Callback من ZainCash — /api/payment/callback
// ════════════════════════════════════════════════
function handleCallback(req, res) {
  try {
    const { token, status } = req.method === 'GET' ? req.query : req.body;
    if (!token) {
      console.warn('[ZainCash] callback received without token');
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=no_token`);
    }

    let decoded;
    try {
      decoded = jwt_zaincash.verify(token, ZAINCASH.SECRET_KEY);
    } catch (err) {
      console.warn('[ZainCash] callback invalid JWT:', err.message);
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=invalid_token`);
    }

    const { orderId, status: txStatus, msg } = decoded;
    console.log(`[ZainCash] callback order=${orderId} status=${txStatus || status} msg=${msg || '-'}`);

    if (txStatus !== 'success' && status !== 'success') {
      const reason = encodeURIComponent(msg || txStatus || 'failed');
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${orderId || ''}&reason=${reason}`);
    }

    const order = pendingOrders.get(orderId);
    if (order) {
      pendingOrders.delete(orderId);
      // ─── انقل الطلب إلى paidOrders حتى يتمكن activateSubscription من التحقق من الدفع ───
      paidOrders.set(orderId, {
        ...order,
        paidAt: new Date().toISOString(),
        consumed: false,
        zaincashTxId: decoded.id || null,
      });
      console.log(`✅ Payment callback — order: ${orderId} plan: ${order.planName} (queued for activation)`);
    } else {
      console.warn(`⚠️ Callback for unknown orderId: ${orderId}`);
    }

    return res.redirect(`${FRONTEND_URL}/payment/success?orderId=${orderId}&plan=${order?.planId || ''}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(`${FRONTEND_URL}/payment/failed?reason=error`);
  }
}

router.post('/callback', handleCallback);
router.get('/callback',  handleCallback);

// ════════════════════════════════════════════════
// 3. تشخيص الحالة العامة — GET /api/payment/zaincash/status
// ════════════════════════════════════════════════
// عام/آمن: لا يكشف القيم الفعلية، فقط ما هو موجود وما هو مفقود.
router.get('/zaincash/status', (req, res) => {
  res.json({
    mode: IS_CONFIGURED ? 'production' : 'misconfigured',
    envMode: ZAINCASH_MODE || null,
    hasMerchantId: !!ZAINCASH.MERCHANT_ID,
    hasApiKey:     !!ZAINCASH.SECRET_KEY,
    hasMsisdn:     !!ZAINCASH.MSISDN,
    apiUrl:        ZAINCASH.API_URL,
    payUrl:        ZAINCASH.PAY_URL,
    redirectUrl:   ZAINCASH.REDIRECT,
    missing:       MISSING_CREDS,
    pendingOrders: pendingOrders.size,
    paidOrders:    paidOrders.size,
  });
});

// ─── مساعدات لـ /api/health ───
router.getMode         = () => (IS_CONFIGURED ? 'production' : 'misconfigured');
router.getPendingCount = () => pendingOrders.size;

// ─── API داخلي لـ activateSubscription: استهلاك طلب مدفوع لمرة واحدة ───
// يُرجِع الـ order إذا موجود وغير مستهلك، أو null لو غير صالح/مستهلك.
// بعد الاستدعاء يُعتبر الطلب مستهلكاً ولا يصح إعادة استخدامه.
router.consumePaidOrder = function (orderId) {
  if (!orderId) return null;
  const order = paidOrders.get(orderId);
  if (!order) return null;
  if (order.consumed) return null;
  order.consumed = true;
  paidOrders.set(orderId, order);
  // احذفه بعد التسوية حتى لا يتراكم
  setTimeout(() => paidOrders.delete(orderId), 5000).unref?.();
  return order;
};
router.PLANS = PLANS;

module.exports = router;
