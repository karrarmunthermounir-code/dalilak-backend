// =============================================
// دليلك — إرسال إشعارات Push عبر FCM
// يعيد استخدام تهيئة Firebase المشتركة (utils/firebase.js)
// =============================================
const { admin, isFirebaseReady } = require('./firebase');
const User = require('../models/User');

// أكواد التوكنات المنتهية/غير الصالحة
const EXPIRED_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];

/**
 * إرسال إشعار لمجموعة توكنات FCM، مع تنظيف التوكنات المنتهية تلقائياً.
 * @param {Object}   opts
 * @param {string[]} opts.fcmTokens - مصفوفة توكنات (يقبل أيضاً توكناً مفرداً)
 * @param {string}   opts.title
 * @param {string}   opts.body
 * @param {Object}   [opts.data]
 */
async function sendPushNotification({ fcmTokens, title, body, data = {} }) {
  if (!isFirebaseReady()) {
    console.warn('⚠️ Push متخطّى — Firebase غير جاهز');
    return { sent: 0, failed: 0 };
  }

  const tokens = (Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens]).filter(Boolean);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const notification = { title, body };
  // FCM يتطلب أن تكون كل قيم data نصوصاً
  const stringData = { click_action: 'FLUTTER_NOTIFICATION_CLICK' };
  for (const [k, v] of Object.entries(data)) stringData[k] = String(v);

  const expired = [];
  const results = await Promise.allSettled(
    tokens.map(token =>
      admin.messaging().send({
        token,
        notification,
        data: stringData,
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
      }).catch(err => {
        if (EXPIRED_CODES.includes(err.code)) expired.push(token);
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;

  // تنظيف التوكنات المنتهية من قاعدة البيانات
  if (expired.length > 0) {
    try {
      await User.updateMany(
        { fcmTokens: { $in: expired } },
        { $pull: { fcmTokens: { $in: expired } } }
      );
      console.log(`🧹 حُذفت ${expired.length} توكن FCM منتهٍ`);
    } catch (err) {
      console.error('خطأ في تنظيف التوكنات:', err.message);
    }
  }

  console.log(`🔔 Push: ${sent}/${tokens.length} أُرسلت`);
  return { sent, failed: tokens.length - sent };
}

/**
 * إرسال إشعار لكل المستخدمين بدور admin.
 */
async function sendPushToAdmins({ title, body, data = {} }) {
  if (!isFirebaseReady()) {
    console.warn('⚠️ Push متخطّى — Firebase غير جاهز');
    return { sent: 0, failed: 0 };
  }

  const admins = await User.find({ role: 'admin' }).select('fcmTokens').lean();
  const tokens = admins.flatMap(a => a.fcmTokens || []).filter(Boolean);

  if (tokens.length === 0) {
    console.log('ℹ️ لا توجد توكنات FCM مسجّلة لأي أدمن');
    return { sent: 0, failed: 0 };
  }

  return sendPushNotification({ fcmTokens: tokens, title, body, data });
}

module.exports = { sendPushNotification, sendPushToAdmins };
