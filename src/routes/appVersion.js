const express = require('express');
const router = express.Router();

// قائمة الإصدارات (يمكن نقلها لـ MongoDB لاحقاً)
const APP_VERSIONS = {
  latest: {
    versionCode: 7,
    versionName: '5.2',
    releaseDate: '2026-06-07',
    downloadUrl: 'https://files.catbox.moe/zaels8.apk',
    isForceUpdate: false,
    minSupportedVersionCode: 1,

    features: [
      '🔐 نظام تأكيد البريد الإلكتروني',
      '🗑️ تحسينات في واجهة الاشتراكات',
      '🐛 إصلاحات أخرى',
    ],

    notes: 'تحديث أمني: تفعيل الحساب الجديد عبر رمز يصل إلى بريدك',
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
