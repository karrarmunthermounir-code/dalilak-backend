const express  = require('express');
const mongoose = require('mongoose');

const placesRouter     = require('./places');
const authRouter       = require('./auth');
const uploadRouter     = require('./upload');
const paymentRouter    = require('./payment');
const adminRouter      = require('./admin');
const appVersionRouter = require('./appVersion');

const router = express.Router(); // mounted at '/'

// ─── جذر + فحوصات سريعة ───
router.get('/', (req, res) => res.json({ message: '🌴 دليلك API — يعمل بنجاح!' }));

router.get('/api/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: paymentRouter.getMode(),
    mongoConnected: mongoose.connection.readyState === 1,
    pendingOrders: paymentRouter.getPendingCount(),
  });
});

// ─── تجميع كل الـ API routes ───
router.use('/api/places',  placesRouter);
router.use('/api/auth',    authRouter);
router.use('/api/upload',  uploadRouter);
router.use('/api/payment', paymentRouter);
router.use('/api/app',     appVersionRouter); // /api/app/version-check
router.use('/api',         adminRouter); // /api/debug/state, /api/admin/*

module.exports = router;
