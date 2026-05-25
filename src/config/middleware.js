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
  // ملاحظة: Capacitor على Android يرسل origin كـ "https://localhost"
  const MOBILE_ORIGINS = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',     // ← Capacitor Android WebView
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const WEB_ORIGINS = [
    'https://dalilak-app.surge.sh',
    'https://dalilk.vercel.app',
    'https://dalilk-theta.vercel.app',
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

  // يقبل أي نشر Vercel لمشروع dalilk (الإنتاج + الفروع + الـ previews)
  // مثال: https://dalilk-theta.vercel.app، https://dalilk-git-main-user.vercel.app
  const isAllowedVercel = (origin) =>
    /^https:\/\/dalilk(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);

  app.use(cors({
    origin: function (origin, callback) {
      console.log('🌐 Request origin:', origin);
      // اسمح للطلبات بدون origin (mobile apps الأصلية، WebView، curl، Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isAllowedVercel(origin)) return callback(null, true);
      console.warn(`⚠️ CORS blocked: ${origin}`);
      return callback(new Error('غير مسموح — CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ─── Body parsers ───
  // 🔒 خفّضنا الحد من 50mb إلى 10mb لتقليل سطح الـ DoS.
  // الصور تُرفَع لـ ImageKit عبر multipart (5mb لكل صورة) — JSON هنا للبيانات النصية + base64 fallback.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

module.exports = { applyMiddleware };
