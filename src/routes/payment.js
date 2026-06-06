const express = require('express');
const crypto = require('crypto');
const { tokenManager, initTransaction, inquireTransaction, API_URL } = require('../services/zaincashV2');
const { normalizeIraqiPhone } = require('../utils/phoneFormatter');

const router = express.Router(); // mounted at /api/payment

// ════════════════════════════════════════════════
// ZainCash V2 Config (OAuth2-based)
// ════════════════════════════════════════════════
const ZAINCASH_MODE = (process.env.ZAINCASH_MODE || '').toLowerCase();
const IS_PRODUCTION = ZAINCASH_MODE === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dalilak-frontend.onrender.com';

// ─── تنظيف قيمة env من المشاكل الشائعة (مسافات/سطور/اقتباسات) ───
function cleanEnv(v) {
  if (v == null) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, '');
}

const BACKEND_URL = cleanEnv(process.env.BACKEND_URL) || 'https://dalilak-api.onrender.com';

const ZAINCASH = {
  MSISDN:        cleanEnv(process.env.ZAINCASH_MSISDN),
  MERCHANT_ID:   cleanEnv(process.env.ZAINCASH_MERCHANT_ID),
  SECRET_KEY:    cleanEnv(process.env.ZAINCASH_API_KEY),
  SERVICE:       (process.env.ZAINCASH_SERVICE || 'دليلك - اشتراك').trim(),
  API_URL,
  CALLBACK_BASE: `${BACKEND_URL}/api/payment/callback`,
};

// ─── ZainCash production-only: لا fallback إطلاقاً ───
const MISSING_CREDS = [];
if (!ZAINCASH.MERCHANT_ID) MISSING_CREDS.push('ZAINCASH_MERCHANT_ID');
if (!ZAINCASH.SECRET_KEY)  MISSING_CREDS.push('ZAINCASH_API_KEY');
if (!ZAINCASH.MSISDN)      MISSING_CREDS.push('ZAINCASH_MSISDN');
const CREDS_OK      = MISSING_CREDS.length === 0;
const IS_CONFIGURED = IS_PRODUCTION && CREDS_OK;

console.log(
  `[ZC-V2] mode=${IS_CONFIGURED ? 'PRODUCTION' : 'MISCONFIGURED'} ` +
  `(ZAINCASH_MODE="${ZAINCASH_MODE || '(unset)'}", credsOK=${CREDS_OK}) apiUrl=${ZAINCASH.API_URL}`
);
if (!IS_CONFIGURED) {
  if (!IS_PRODUCTION) {
    console.error(`[ZC-V2] ❌ ZAINCASH_MODE != "production" (current="${ZAINCASH_MODE || '(unset)'}") — /zaincash/init will reject.`);
  }
  if (MISSING_CREDS.length) {
    console.error(`[ZC-V2] ❌ Missing env vars: ${MISSING_CREDS.join(', ')}`);
  }
}

const PLANS = {
  free_trial: { id: 'free_trial',  name: 'تجربة مجانية', price: 0,      days: 30 },
  monthly:    { id: 'monthly_pro', name: 'شهري',           price: 25000,  days: 30  },
  yearly:     { id: 'premium',     name: 'سنوي',           price: 130000, days: 365 },
};

// ════════════════════════════════════════════════
// Recursive response walkers — يجدون payUrl/transactionId مهما كان
// اسم الحقل أو موقعه في الـ response (data.*, result.*, transaction.*, …)
// ════════════════════════════════════════════════
const URL_KEY_PREFER = [
  'redirectUrl', 'redirectURL', 'redirect_url',
  'paymentUrl',  'paymentURL',  'payment_url',
  'payUrl',      'payURL',
  'gatewayUrl',  'checkoutUrl', 'paymentLink',
  'url',         'link',
];
const ID_KEY_PREFER = [
  'transactionId', 'transaction_id', 'txId', 'tx_id',
  'paymentId',     'payment_id',
  'referenceId',   'reference_id',
  'id', '_id',
];

function findFirstUrl(obj, depth = 0) {
  if (depth > 6 || obj == null) return null;
  if (typeof obj === 'string') {
    return /^https?:\/\//i.test(obj) ? obj : null;
  }
  if (typeof obj !== 'object') return null;
  // 1) فحص الأسماء المفضّلة على هذا المستوى
  for (const k of URL_KEY_PREFER) {
    const v = obj[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  // 2) walk children
  for (const v of Object.values(obj)) {
    const found = findFirstUrl(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function findFirstId(obj, depth = 0) {
  if (depth > 6 || obj == null || typeof obj !== 'object') return null;
  // 1) المفضّلة أولاً
  for (const k of ID_KEY_PREFER) {
    const v = obj[k];
    if (v != null && (typeof v === 'string' || typeof v === 'number')) {
      const s = String(v);
      if (s.length > 0) return s;
    }
  }
  // 2) walk children
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null) {
      const found = findFirstId(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

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
// 1. إنشاء طلب دفع ZainCash V2 — POST /api/payment/zaincash/init
// ════════════════════════════════════════════════
router.post('/zaincash/init', async (req, res) => {
  try {
    // ─── Guard: لا تفعيل دفع إذا ZainCash غير مهيأ ───
    if (!IS_CONFIGURED) {
      console.error(`[ZC-V2] init rejected — misconfigured. missing=${MISSING_CREDS.join(',') || 'none'} mode="${ZAINCASH_MODE}"`);
      return res.status(503).json({
        success: false,
        error: 'ZainCash غير مهيأ — اتصل بالدعم',
        misconfigured: true,
      });
    }

    const { planId, name, phone, email } = req.body;
    const planKey = (planId === 'monthly_pro' || planId === 'monthly') ? 'monthly' : 'yearly';
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ success: false, error: 'خطة غير صحيحة' });

    // ─── Phone normalization: نقبل أي صيغة عراقية شائعة ونحول لـ 9647xxxxxxxxx ───
    const normalizedPhone = normalizeIraqiPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'رقم الهاتف غير صحيح. تأكد من الصيغة: 07XXXXXXXXX',
      });
    }

    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const externalReferenceId = crypto.randomUUID();

    // ─── Callback URLs: status & orderId hints. Backend يعيد التحقق عبر Inquiry. ───
    const successUrl = `${ZAINCASH.CALLBACK_BASE}?status=success&orderId=${encodeURIComponent(orderId)}`;
    const failureUrl = `${ZAINCASH.CALLBACK_BASE}?status=failed&orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl  = `${ZAINCASH.CALLBACK_BASE}?status=cancelled&orderId=${encodeURIComponent(orderId)}`;

    // ─── Guard: المستخدم لا يدفع من نفس رقم التاجر ───
    // ZainCash يرفض ذلك بـ ZC-30710 ("حدث خطأ ما") بدون توضيح
    if (normalizedPhone === ZAINCASH.MSISDN) {
      console.warn(`[ZC-V2] init rejected — customer phone equals merchant MSISDN: ${normalizedPhone}`);
      return res.status(400).json({
        success: false,
        error: 'لا يمكنك الدفع باستخدام رقم محفظة التاجر. استخدم رقم محفظتك الشخصية في ZainCash.',
      });
    }

    let initData;
    try {
      initData = await initTransaction({
        orderId,
        externalReferenceId,
        amount:        plan.price,
        serviceType:   `${ZAINCASH.SERVICE} ${plan.name}`,
        customerPhone: normalizedPhone,
        language:      'ar',
        successUrl, failureUrl, cancelUrl,
      });
    } catch (err) {
      // 4xx/5xx من ZainCash — رفع طبيعي
      throw err;
    }

    // ─── ZainCash V2 quirk: يُرجِع 200 OK مع envelope `{err: {msg}, redirectUrl:null}`
    //     لما يرفض المعاملة (مثل ZC-30710). نكشف ذلك صراحةً.
    if (initData && initData.err) {
      const zcMsg  = initData.err.msg || initData.err.message || JSON.stringify(initData.err);
      const zcCode = (zcMsg.match(/ZC-\d+/) || [])[0] || null;
      console.error(`[ZC-V2] ZainCash rejected: code=${zcCode || 'unknown'} msg="${zcMsg}"`);

      // ترجمة أكواد شائعة لرسائل واضحة للمستخدم النهائي
      let friendly = `ZainCash رفض المعاملة: ${zcMsg}`;
      if (zcCode === 'ZC-30710') {
        friendly = 'فشل إنشاء المعاملة. تأكد من أن رقم محفظتك مفعّل في ZainCash، وأن لديك رصيد كافٍ، وأنه ليس نفس رقم التاجر.';
      }

      return res.status(502).json({
        success: false,
        error: friendly,
        _zaincashCode: zcCode,
        _zaincashMsg: zcMsg,
      });
    }

    // ─── Recursive search: find ANY https URL or ID in the response،
    //     regardless of nesting or field name (data.* / result.* / transaction.* …)
    const payUrl        = findFirstUrl(initData);
    const transactionId = findFirstId(initData);

    if (!payUrl) {
      console.error('[ZC-V2] init response missing payUrl. Full response:');
      console.error(JSON.stringify(initData, null, 2));
      return res.status(502).json({
        success: false,
        error:   'استجابة ZainCash لا تحتوي على رابط الدفع',
        _raw:    initData,
        _keys:   Object.keys(initData || {}),
      });
    }

    pendingOrders.set(orderId, {
      orderId,
      planId:   plan.id,
      planName: plan.name,
      plan,
      name,
      phone: normalizedPhone,
      email,
      externalReferenceId,
      transactionId,
      createdAt: new Date().toISOString(),
    });

    console.log(`[ZC-V2] ✅ init ok order=${orderId} tx=${transactionId} → ${payUrl}`);
    return res.json({ success: true, payUrl, orderId });
  } catch (err) {
    console.error('[ZC-V2] init error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════
// 2. Callback من ZainCash — /api/payment/callback (GET & POST)
// ────────────────────────────────────────────────
// المصدر الموثوق للحالة: Inquiry API (وليس JWT في query).
// ZainCash يحوّل المستخدم لـ successUrl/failureUrl/cancelUrl المحدّدة في init.
// ════════════════════════════════════════════════
async function handleCallback(req, res) {
  try {
    const params = req.method === 'GET' ? req.query : { ...req.body, ...req.query };
    const { status, orderId, token } = params;

    console.log(`[ZC-V2] callback method=${req.method} status=${status} order=${orderId} hasToken=${!!token}`);

    if (!orderId) {
      console.warn('[ZC-V2] callback missing orderId');
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=no_order_id`);
    }

    const order = pendingOrders.get(orderId);
    if (!order) {
      console.warn(`[ZC-V2] callback for unknown orderId=${orderId}`);
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=unknown_order`);
    }

    // ─── Status hint says non-success → fail fast (no inquiry needed) ───
    if (status && status !== 'success') {
      pendingOrders.delete(orderId);
      console.log(`[ZC-V2] callback non-success status=${status} order=${orderId}`);
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(status)}`);
    }

    // ─── SOURCE OF TRUTH: Inquiry API ───
    if (!order.transactionId) {
      console.error(`[ZC-V2] callback order=${orderId} has no transactionId — cannot inquire`);
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=no_tx_id`);
    }

    let inquiry;
    try {
      inquiry = await inquireTransaction(order.transactionId);
    } catch (err) {
      console.error(`[ZC-V2] callback inquiry failed order=${orderId}:`, err.message);
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=inquiry_error`);
    }

    const txStatus = String(inquiry.status || inquiry.state || '').toUpperCase();
    const isPaid = ['COMPLETED', 'SUCCESS', 'PAID', 'SUCCESSFUL'].includes(txStatus);

    if (!isPaid) {
      pendingOrders.delete(orderId);
      console.log(`[ZC-V2] callback inquiry not paid status=${txStatus} order=${orderId}`);
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(txStatus || 'not_paid')}`);
    }

    // ─── ✅ Verified paid → move to paidOrders ───
    pendingOrders.delete(orderId);
    paidOrders.set(orderId, {
      ...order,
      paidAt:        new Date().toISOString(),
      consumed:      false,
      inquiryStatus: txStatus,
    });

    console.log(`[ZC-V2] ✅ Payment confirmed order=${orderId} plan=${order.planName} tx=${order.transactionId}`);
    return res.redirect(
      `${FRONTEND_URL}/payment/success?orderId=${encodeURIComponent(orderId)}&plan=${encodeURIComponent(order.planId)}`
    );
  } catch (err) {
    console.error('[ZC-V2] callback error:', err);
    res.redirect(`${FRONTEND_URL}/payment/failed?reason=server_error`);
  }
}

router.get('/callback',  handleCallback);
router.post('/callback', handleCallback);

// ════════════════════════════════════════════════
// 3. تشخيص الحالة العامة — GET /api/payment/zaincash/status
// ────────────────────────────────────────────────
// عام/آمن: لا يكشف القيم الفعلية، فقط شكلها (الطول، أول/آخر 4 أحرف).
// يحاول تجديد OAuth2 token مباشرةً للتأكد من صحة الـ creds.
// ════════════════════════════════════════════════
function preview(s) {
  if (!s) return '(empty)';
  if (s.length <= 8) return '(too short)';
  return s.slice(0, 4) + '...' + s.slice(-4);
}

router.get('/zaincash/status', async (req, res) => {
  const merchantId = ZAINCASH.MERCHANT_ID;
  const msisdn     = ZAINCASH.MSISDN;
  const apiKey     = ZAINCASH.SECRET_KEY;

  const out = {
    version:  'v2',
    mode:     IS_CONFIGURED ? 'production' : 'misconfigured',
    envMode:  ZAINCASH_MODE || null,

    hasMerchantId: !!merchantId,
    hasApiKey:     !!apiKey,
    hasMsisdn:     !!msisdn,
    missing:       MISSING_CREDS,

    merchantId: { length: merchantId.length, preview: preview(merchantId) },
    msisdn:     { length: msisdn.length,     preview: preview(msisdn), formatValid: /^964[0-9]{10}$/.test(msisdn) },
    apiKey:     { length: apiKey.length },

    apiUrl:       ZAINCASH.API_URL,
    callbackBase: ZAINCASH.CALLBACK_BASE,

    pendingOrders: pendingOrders.size,
    paidOrders:    paidOrders.size,

    oauth:      tokenManager.diag(),
    oauthCheck: 'unknown',
  };

  // ─── Live OAuth probe ───
  if (IS_CONFIGURED) {
    try {
      await tokenManager.getToken();
      out.oauthCheck = 'success';
    } catch (err) {
      out.oauthCheck = 'failed';
      out.oauthError = err.message;
    }
    out.oauth = tokenManager.diag();
  } else {
    out.oauthCheck = 'skipped_misconfigured';
  }

  res.json(out);
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
