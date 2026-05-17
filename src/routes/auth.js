const express = require('express');
const router  = express.Router();
const {
  register, login, getMe, updateProfile,
  toggleFavorite, activateSubscription, getStats,
  requestPasswordReset, resetPassword,
  savePushSubscription, getVapidKey, saveFcmToken,
  getMyData, updateSettings,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ─── المسارات العامة ───
router.post('/register',       register);
router.post('/login',          login);
router.post('/forgot-password', requestPasswordReset); // طلب OTP
router.post('/reset-password',  resetPassword);        // تعيين كلمة مرور جديدة

// ─── المسارات المحمية (تتطلب تسجيل الدخول) ───
router.get('/me',          protect, getMe);
router.get('/my-data',     protect, getMyData);        // استعادة كاملة لبيانات المستخدم
router.put('/profile',     protect, updateProfile);
router.put('/settings',    protect, updateSettings);   // حفظ الإعدادات الدائمة
router.post('/favorite',   protect, toggleFavorite);
router.post('/subscribe',  protect, activateSubscription);
router.get('/stats/:placeId?', protect, getStats);

// ─── إشعارات Push ───
router.get('/vapid-key',        getVapidKey);
router.post('/push-subscribe',  protect, savePushSubscription);
router.post('/fcm-token',       protect, saveFcmToken);       // حفظ FCM token لإشعارات Android

module.exports = router;
