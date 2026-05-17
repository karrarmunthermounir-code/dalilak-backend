const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

// ────────────────────────────────────────────────
// تطبيق كل الـ middleware العامة على التطبيق
// (Rate limiting + CORS + body parsers)
// ────────────────────────────────────────────────
function applyMiddleware(app) {
  // ─── 🔐 Rate Limiting ───
  // حد عام: 100 طلب / 15 دقيقة لكل IP
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'طلبات كثيرة جداً، حاول بعد 15 دقيقة' },
  });

  // حد خاص لتسجيل الدخول: 5 محاولات / 15 دقيقة
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة' },
  });

  app.use(globalLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', loginLimiter);

  // ─── 🔐 CORS — قائمة محددة من الأصول المسموحة ───
  // أصول تطبيق الموبايل (Capacitor / Ionic) + الويب
  const MOBILE_ORIGINS = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
  ];
  const WEB_ORIGINS = [
    'https://dalilak-app.surge.sh',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
  ];

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = [
    ...(allowedOriginsEnv ? allowedOriginsEnv.split(',').map(o => o.trim()) : WEB_ORIGINS),
    ...MOBILE_ORIGINS,
  ];

  // إضافة عنوان الفرونتند تلقائياً إذا موجود
  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.use(cors({
    origin: function (origin, callback) {
      // ⚠️ مؤقت للتشخيص فقط — يقبل كل الأصول. أعِده للقائمة بعد الانتهاء.
      console.log('🌐 Request origin:', origin);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ─── Body parsers ───
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
}

module.exports = { applyMiddleware };
