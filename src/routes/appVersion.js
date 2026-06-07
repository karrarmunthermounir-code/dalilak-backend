const express = require('express');
const router = express.Router();

// قائمة الإصدارات (يمكن نقلها لـ MongoDB لاحقاً)
const APP_VERSIONS = {
  latest: {
    versionCode: 8,
    versionName: '5.3',
    releaseDate: '2026-06-08',
    downloadUrl: 'https://files.catbox.moe/bgchuw.apk',
    isForceUpdate: false,
    minSupportedVersionCode: 1,

    features: [
      '📧 تسجيل بالإيميل فقط (أبسط وأسرع)',
      '🎨 تحسين واجهة المصادقة',
      '🐛 إصلاحات أخرى',
    ],

    notes: 'واجهة تسجيل أنظف — البريد الإلكتروني فقط',
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
