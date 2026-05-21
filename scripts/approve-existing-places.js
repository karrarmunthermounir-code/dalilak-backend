// =============================================
// دليلك — Migration: ضبط حالة الأماكن القديمة كـ approved
// الأماكن التي أُنشئت قبل نظام الموافقة لا تملك حقل status،
// وبدون هذا السكربت ستختفي من القائمة العامة بعد النشر.
// التشغيل (مرة واحدة بعد النشر):  node scripts/approve-existing-places.js
// =============================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function migrate() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI مفقود');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ متصل بـ MongoDB');

  const Place = require('../src/models/Place');

  // اضبط status='approved' لكل مكان لا يملك حقل status (أو قيمته فارغة)
  const result = await Place.updateMany(
    { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] },
    { $set: { status: 'approved' } }
  );

  console.log('───────────────────────────');
  console.log('📊 الأماكن المطابقة :', result.matchedCount);
  console.log('✅ الأماكن المحدّثة :', result.modifiedCount);
  console.log('───────────────────────────');
  console.log('الأماكن القديمة الآن approved وستبقى ظاهرة.');
  console.log('الأماكن الجديدة بعد الآن ستكون pending حتى موافقة الأدمن.');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
