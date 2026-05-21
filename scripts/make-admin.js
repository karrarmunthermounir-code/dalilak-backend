// =============================================
// دليلك — Make Admin: ترقية المستخدم لدور admin
// التشغيل:  node scripts/make-admin.js
// =============================================
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const TARGET_EMAIL = process.env.MAKE_ADMIN_EMAIL || 'karrar.munther.mounir@gmail.com';

async function makeAdmin() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI غير موجود في متغيرات البيئة');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ متصل بـ MongoDB');

  const result = await User.updateOne(
    { identifier: TARGET_EMAIL },
    { role: 'admin' }
  );

  if (result.matchedCount === 0) {
    console.warn(`⚠️ لا يوجد مستخدم بالإيميل: ${TARGET_EMAIL}`);
    console.warn('   تأكد من تسجيل الدخول مرة واحدة على الأقل قبل تشغيل السكربت');
  } else {
    console.log(`✅ تم تحديث الدور لـ admin: ${TARGET_EMAIL}`);
    console.log('   النتيجة:', result);
  }

  await mongoose.disconnect();
  process.exit(0);
}

makeAdmin().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
