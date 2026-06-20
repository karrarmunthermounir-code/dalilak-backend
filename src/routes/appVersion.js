const express = require('express');
const router = express.Router();

// قائمة الإصدارات (يمكن نقلها لـ MongoDB لاحقاً)
const APP_VERSIONS = {
  latest: {
    versionCode: 9,
    versionName: '5.4',
    releaseDate: '2026-06-20',
    downloadUrl: 'https://files.catbox.moe/bgchuw.apk',
    isForceUpdate: false,
    minSupportedVersionCode: 1,

    features: [
      '🚀 تسجيل سريع وسهل بدون رموز تأكيد',
      '📱 تسجيل بإيميل أو رقم موبايل عراقي',
      '🎨 تحسينات في الواجهة',
      '🐛 إصلاحات أخرى',
    ],

    notes: 'إلغاء OTP مؤقتاً — تسجيل مباشر بإيميل أو رقم موبايل',
  },
};

router.get('/version-check', (req, res) => {
  try {
    const { versionCode } = req.query;
    const currentVersion = parseInt(versionCode) || 0;
    const latest = APP_VERSIONS.latest;

    const updateAvailable = currentVersion < latest.versionCode;
    const isForceUpdate =
      currentVersion < latest.minSupportedVersionCode ||
      (updateAvailable && latest.isForceUpdate);

    res.json({
      success: true,
      currentVersion,
      latestVersion: {
        versionCode: latest.versionCode,
        versionName: latest.versionName,
        releaseDate: latest.releaseDate,
      },
      updateAvailable,
      isForceUpdate,
      downloadUrl: latest.downloadUrl,
      features: latest.features,
      notes: latest.notes,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
