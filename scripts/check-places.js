// =============================================
// دليلك — Check Places: فحص حالة آخر الأماكن (قراءة فقط)
// التشغيل:  node scripts/check-places.js
// =============================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function checkPlaces() {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI مفقود');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const Place = require('../src/models/Place');

  const places = await Place.find({})
    .sort('-createdAt')
    .limit(5)
    .select('name status createdAt')
    .lean();

  console.log('═══════════════════════════════════════');
  console.log('آخر 5 أماكن:');
  console.log('═══════════════════════════════════════');
  places.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   الحالة: ${p.status || 'غير محدد'}`);
    console.log(`   التاريخ: ${p.createdAt}`);
    console.log('');
  });

  process.exit(0);
}

checkPlaces().catch(console.error);
