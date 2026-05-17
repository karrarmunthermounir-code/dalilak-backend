const express = require('express');
const jwt_zaincash = require('jsonwebtoken');

const router = express.Router(); // mounted at /api/payment

// ════════════════════════════════════════════════
// ZainCash Config
// ════════════════════════════════════════════════
const IS_TEST = process.env.NODE_ENV !== 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dalilak-frontend.onrender.com';

const ZAINCASH = {
  MSISDN:      process.env.ZAINCASH_MSISDN   || '9647832373852',
  MERCHANT_ID: process.env.ZAINCASH_MERCHANT || 'YOUR_MERCHANT_ID',
  SECRET_KEY:  process.env.ZAINCASH_SECRET   || 'YOUR_SECRET_KEY',
  SERVICE:     process.env.ZAINCASH_SERVICE  || 'دليلك - اشتراك',
  REDIRECT:    process.env.ZAINCASH_REDIRECT || `${process.env.BACKEND_URL || 'https://dalilak-api.onrender.com'}/api/payment/callback`,
  API_URL: IS_TEST
    ? 'https://test.zaincash.iq/transaction/init'
    : 'https://api.zaincash.iq/transaction/init',
  PAY_URL: IS_TEST
    ? 'https://test.zaincash.iq/transaction/pay'
    : 'https://api.zaincash.iq/transaction/pay',
};

const PLANS = {
  free_trial: { id: 'free_trial', name: 'تجربة مجانية', price: 0, days: 30 },
  monthly: { id: 'monthly_pro', name: 'شهري',  price: 65000,  days: 30  },
  yearly:  { id: 'premium',     name: 'سنوي', price: 325000, days: 365 },
};

// ─── مخازن مؤقتة للطلبات (يمكن استبدالها بـ MongoDB لاحقاً) ───
const pendingOrders = new Map();

// ════════════════════════════════════════════════
// 1. إنشاء طلب دفع ZainCash — POST /api/payment/zaincash/init
// ════════════════════════════════════════════════
router.post('/zaincash/init', async (req, res) => {
  try {
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

    // ─── وضع Demo ───
    if (ZAINCASH.MERCHANT_ID === 'YOUR_MERCHANT_ID') {
      console.log('[DEMO] ZainCash payment for order:', orderId);
      const demoUrl = `${FRONTEND_URL}/payment/success?orderId=${orderId}&demo=true`;
      return res.json({ success: true, payUrl: demoUrl, orderId, demo: true });
    }

    // ─── ZainCash حقيقي ───
    const payload = {
      msisdn:      ZAINCASH.MSISDN,
      amount:      plan.price,
      serviceType: ZAINCASH.SERVICE,
      orderId,
      redirectUrl: ZAINCASH.REDIRECT,
      iat:  Math.floor(Date.now() / 1000),
      exp:  Math.floor(Date.now() / 1000) + 3600,
    };

    const token = jwt_zaincash.sign(payload, ZAINCASH.SECRET_KEY);

    const response = await fetch(ZAINCASH.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, merchantId: ZAINCASH.MERCHANT_ID, lang: 'ar' }).toString(),
    });

    const data = await response.json();

    if (data.status === 'SUCCESS' && data.id) {
      return res.json({ success: true, payUrl: `${ZAINCASH.PAY_URL}?id=${data.id}`, orderId });
    } else if (data.payUrl) {
      return res.json({ success: true, payUrl: data.payUrl, orderId });
    } else {
      throw new Error(data.msg || 'فشل إنشاء طلب ZainCash');
    }
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
    if (!token) return res.redirect(`${FRONTEND_URL}/payment/failed?reason=no_token`);

    let decoded;
    try { decoded = jwt_zaincash.verify(token, ZAINCASH.SECRET_KEY); }
    catch { return res.redirect(`${FRONTEND_URL}/payment/failed?reason=invalid_token`); }

    const { orderId, status: txStatus } = decoded;
    if (txStatus !== 'success' && status !== 'success') {
      return res.redirect(`${FRONTEND_URL}/payment/failed?orderId=${orderId}`);
    }

    const order = pendingOrders.get(orderId);
    if (order) {
      pendingOrders.delete(orderId);
      console.log(`✅ Payment callback — order: ${orderId} plan: ${order.planName}`);
    }

    return res.redirect(`${FRONTEND_URL}/payment/success?orderId=${orderId}&plan=${order?.planId || ''}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(`${FRONTEND_URL}/payment/failed?reason=error`);
  }
}

router.post('/callback', handleCallback);
router.get('/callback',  handleCallback);

// ─── مساعدات لـ /api/health ───
router.getMode         = () => (ZAINCASH.MERCHANT_ID === 'YOUR_MERCHANT_ID' ? 'demo' : 'production');
router.getPendingCount = () => pendingOrders.size;

module.exports = router;
