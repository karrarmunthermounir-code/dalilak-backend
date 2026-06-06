const express = require('express');
const router = express.Router();

// قائمة الإصدارات (يمكن نقلها لـ MongoDB لاحقاً)
const APP_VERSIONS = {
  latest: {
    versionCode: 6,
    versionName: '5.1',
    releaseDate: '2026-06-06',
    downloadUrl: 'https://files.catbox.moe/7ise6p.apk',
    isForceUpdate: false,
    minSupportedVersionCode: 1,

    features: [
      '✨ نظام إشعارات التحديثات',
      '💰 أسعار جديدة (25K شهري / 130K سنوي)',
      '🔐 تكامل ZainCash V2 محسّن',
      '📱 دعم كل صيغ أرقام الهاتف العراقية',
      '🐛 إصلاحات وتحسينات عامة',
    ],

    notes: 'تحديث مهم يحسن تجربة الدفع ويضيف إشعارات داخل التطبيق',
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
