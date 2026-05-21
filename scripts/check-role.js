// =============================================
// دليلك — Check Role: فحص دور المستخدم (قراءة فقط)
// التشغيل:  node scripts/check-role.js
// =============================================
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const TARGET_EMAIL = process.env.CHECK_EMAIL || 'karrar.munther.mounir@gmail.com';

async function checkRole() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI غير موجود في متغيرات البيئة');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ متصل بـ MongoDB');

  const user = await User.findOne({ identifier: TARGET_EMAIL })
    .select('name identifier role createdAt');

  if (!user) {
    console.warn(`⚠️ لا يوجد مستخدم بالإيميل: ${TARGET_EMAIL}`);
  } else {
    console.log('───────────────────────────');
    console.log('👤 الاسم   :', user.name);
    console.log('✉️  الإيميل :', user.identifier);
    console.log('🛡️  الدور   :', user.role);
    console.log('   isAdmin?:', user.role === 'admin' ? '✅ نعم' : '❌ لا');
    console.log('───────────────────────────');
  }

  await mongoose.disconnect();
  process.exit(0);
}

checkRole().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
