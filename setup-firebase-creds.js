/**
 * أداة تحويل ملف Firebase Service Account JSON إلى متغير بيئة
 * 
 * الاستخدام:
 * 1. نزّل ملف الـ Service Account JSON من Firebase Console
 * 2. حطه بنفس مجلد هذا السكربت
 * 3. شغّل: node setup-firebase-creds.js <اسم-الملف.json>
 * 4. انسخ الناتج وحطه في Render كمتغير FIREBASE_CREDENTIALS
 */

const fs = require('fs');
const path = require('path');

const fileName = process.argv[2];

if (!fileName) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 أداة تحويل Firebase Service Account');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  الاستخدام:');
  console.log('    node setup-firebase-creds.js <اسم-الملف.json>');
  console.log('');
  console.log('  مثال:');
  console.log('    node setup-firebase-creds.js dalilak-app-34042-firebase-adminsdk.json');
  console.log('');

  // ابحث عن ملفات JSON في المجلد الحالي
  const jsonFiles = fs.readdirSync('.').filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
  if (jsonFiles.length > 0) {
    console.log('  الملفات الموجودة:');
    jsonFiles.forEach(f => console.log(`    📄 ${f}`));
    console.log('');
  }
  process.exit(1);
}

const filePath = path.resolve(fileName);

if (!fs.existsSync(filePath)) {
  console.error(`❌ الملف غير موجود: ${filePath}`);
  process.exit(1);
}

try {
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);

  // تحقق من الحقول المطلوبة
  const required = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
  const missing = required.filter(k => !json[k]);
  if (missing.length > 0) {
    console.error(`❌ حقول ناقصة: ${missing.join(', ')}`);
    process.exit(1);
  }

  // تحقق من الـ private_key
  if (!json.private_key.includes('BEGIN PRIVATE KEY')) {
    console.error('❌ الـ private_key مو بالتنسيق الصحيح');
    process.exit(1);
  }

  // حوّل إلى سطر واحد (JSON.stringify)
  const oneLine = JSON.stringify(json);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ الملف صحيح!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📌 Project: ${json.project_id}`);
  console.log(`  📧 Email:   ${json.client_email}`);
  console.log(`  🔑 Key ID:  ${json.private_key_id.substring(0, 8)}...`);
  console.log('');
  console.log('  ─── انسخ السطر التالي وحطه كقيمة FIREBASE_CREDENTIALS في Render ───');
  console.log('');
  console.log(oneLine);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ⚠️  تأكد تنسخ السطر كامل!');
  console.log('═══════════════════════════════════════════════════════════');

} catch (err) {
  console.error(`❌ خطأ في قراءة الملف: ${err.message}`);
  process.exit(1);
}
