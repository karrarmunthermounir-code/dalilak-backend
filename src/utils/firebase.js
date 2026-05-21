// =============================================
// دليلك — وحدة تهيئة Firebase Admin المشتركة
// مصدر واحد للتهيئة — يمنع تكرار admin.initializeApp()
// =============================================
const admin = require('firebase-admin');

function initFirebase() {
  // تمت التهيئة مسبقاً — لا تُعِدها
  if (admin.apps.length) return;

  try {
    const raw = process.env.FIREBASE_CREDENTIALS;
    if (!raw) {
      console.warn('⚠️ FIREBASE_CREDENTIALS غير مضبوط — إشعارات Push معطّلة');
      return;
    }

    const creds = JSON.parse(raw);
    // إصلاح الـ private_key — تحويل \n النصية إلى أسطر حقيقية
    if (creds.private_key) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({ credential: admin.credential.cert(creds) });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin init error:', err.message);
  }
}

// التهيئة عند تحميل الموديول لأول مرة
initFirebase();

// هل Firebase جاهز للاستخدام؟
const isFirebaseReady = () => admin.apps.length > 0;

module.exports = { admin, isFirebaseReady };
