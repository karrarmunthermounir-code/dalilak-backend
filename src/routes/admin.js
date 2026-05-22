const express  = require('express');
const mongoose = require('mongoose');
const Place = require('../models/Place');
const User  = require('../models/User');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router(); // mounted at /api

// ════════════════════════════════════════════════
// 🔍 تشخيص سريع — الحالة الحقيقية للـ DB (محمي بـ Admin)
// GET /api/debug/state
// ════════════════════════════════════════════════
router.get('/debug/state', requireAdmin, async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.json({ connected: false });
  const places = await Place.find({ isActive: true }).select('name ownerId').lean();
  const users  = await User.find({}).select('name identifier role _id').lean();
  res.json({
    connected: true,
    places: places.map(p => ({ name: p.name, ownerId: p.ownerId })),
    users:  users.map(u => ({ name: u.name, id: String(u._id), identifier: u.identifier, role: u.role })),
  });
});

// ملاحظة: أُزيلت endpoints الصيانة التدميرية (fix-owners / force-assign)
// لأنها كانت تعيد إسناد ملكية الأماكن — أي عملية لمرة واحدة تُنفّذ
// كسكربت محلي عبر Render Shell، لا كـ endpoint حيّ.

module.exports = router;
