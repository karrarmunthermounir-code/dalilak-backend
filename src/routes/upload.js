const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── تهيئة ImageKit (دفاعية — لا تُسقط السيرفر إن غابت المتغيرات) ───
let imagekit = null;
try {
  if (process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT) {
    imagekit = new ImageKit({
      publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
    console.log('✅ ImageKit initialized');
  } else {
    console.warn('⚠️ متغيرات ImageKit غير مضبوطة — رفع الصور معطّل');
  }
} catch (err) {
  console.error('❌ ImageKit init error:', err.message);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB كحدّ أقصى
});

// ════════════════════════════════════════════════
// POST /api/upload/image — رفع صورة واحدة (محمي)
// ════════════════════════════════════════════════
router.post('/image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({ success: false, message: 'خدمة رفع الصور غير مهيّأة' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي صورة' });
    }

    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName: `dalilak_${Date.now()}_${req.file.originalname || 'image'}`,
      folder: '/dalilak',
      useUniqueFileName: true,
      transformation: {
        pre: 'q-80', // ضغط 80%
      },
    });

    res.json({
      success: true,
      url: result.url,
      fileId: result.fileId,
    });
  } catch (err) {
    console.error('Image upload failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'فشل رفع الصورة',
      error: err.message,
    });
  }
});

module.exports = router;
