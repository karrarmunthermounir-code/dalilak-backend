const express = require('express');
const multer  = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const router = express.Router();

// ─── Cloudinary Config ───
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key:    process.env.CLOUDINARY_API_KEY    || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// ─── Multer + Cloudinary Storage ───
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'dalilak-menu',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto' }
    ],
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ════════════════════════════════════════════════
// POST /api/upload — رفع صورة واحدة
// ════════════════════════════════════════════════
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم اختيار صورة' });
    }
    res.json({
      success: true,
      url: req.file.path, // Cloudinary URL
      public_id: req.file.filename,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'فشل رفع الصورة' });
  }
});

// ════════════════════════════════════════════════
// DELETE /api/upload — حذف صورة
// ════════════════════════════════════════════════
router.delete('/', async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ success: false });
    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
