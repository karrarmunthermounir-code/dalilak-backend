const mongoose = require('mongoose');

// عنوان قاعدة البيانات (يدعم MONGO_URI و MONGODB_URI)
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/dalilak';

// ─── الاتصال بـ MongoDB ───
// يُرجع true عند النجاح و false عند الفشل (السيرفر يعمل بدون DB كـ fallback)
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // 10 ثوانٍ — يلائم البداية الباردة على Railway
      connectTimeoutMS: 10000,
    });
    console.log('✅ MongoDB متصل');
    return true;
  } catch (err) {
    console.warn('⚠️  MongoDB غير متصل — يعمل بدون قاعدة بيانات:', err.message);
    return false;
  }
}

module.exports = { connectDB, MONGO_URI };
