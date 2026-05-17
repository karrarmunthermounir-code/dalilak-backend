require('dotenv').config();
const express = require('express');

const { applyMiddleware } = require('./config/middleware');
const { connectDB }       = require('./config/database');
const routes              = require('./routes');
const paymentRouter       = require('./routes/payment');

const app  = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dalilak-frontend.onrender.com';

// ─── Middleware (Rate limiting + CORS + body parsers) ───
applyMiddleware(app);

// ─── كل الـ routes ───
app.use('/', routes);

// ─── معالج الأخطاء العام ───
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
});

// ════════════════════════════════════════════════
// تشغيل السيرفر (بعد محاولة الاتصال بـ MongoDB)
// ════════════════════════════════════════════════
function startServer(dbConnected) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    startKeepAlive();
  });
}

connectDB().then(startServer);

// ════════════════════════════════════════════════
// Keep-Alive: يمنع سيرفر Render المجاني من النوم
// ════════════════════════════════════════════════
function startKeepAlive() {
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  // نقرع السيرفر كل 14 دقيقة لمنع النوم (Render ينام بعد 15 دقيقة)
  setInterval(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/ping`);
      const data = await res.json();
      console.log(`💓 Keep-alive ping — ${data.time}`);
    } catch (e) {
      console.warn('⚠️ Keep-alive ping failed:', e.message);
    }
  }, 14 * 60 * 1000); // كل 14 دقيقة
  console.log('💓 Keep-alive مفعّل — كل 14 دقيقة');
}
