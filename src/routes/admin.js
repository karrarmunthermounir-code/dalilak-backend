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

// ════════════════════════════════════════════════
// 🔧 إصلاح ownerId للأماكن القديمة — GET /api/admin/fix-owners
// ════════════════════════════════════════════════
router.get('/admin/fix-owners', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      return res.json({ success: false, message: 'MongoDB غير متصل' });

    const { targetIdentifier } = req.query;

    // جلب كل الأماكن الخام (بدون casting) والمستخدمين
    const allPlaces = await Place.collection.find({ isActive: true }).toArray();
    const allUsers  = await User.find({}).lean();
    const report = [];

    // 1. إصلاح الأماكن المرتبطة بـ identifier (string) بدلاً من ObjectId
    for (const u of allUsers) {
      const userId = u._id;
      const byIdent = allPlaces.filter(p =>
        typeof p.ownerId === 'string' && p.ownerId === u.identifier
      );
      for (const p of byIdent) {
        await Place.collection.updateOne({ _id: p._id }, { $set: { ownerId: userId } });
        report.push(`fixed(identifier): "${p.name}" → ${userId} (${u.name})`);
      }
    }

    // 2. إصلاح الأماكن بدون مالك (anonymous / null / string IDs)
    const unowned = allPlaces.filter(p =>
      !p.ownerId || typeof p.ownerId === 'string'
    );

    let targetUser;
    if (targetIdentifier) {
      targetUser = allUsers.find(u => u.identifier === targetIdentifier);
    }
    if (!targetUser) {
      targetUser = allUsers.find(u => u.role === 'owner') || allUsers[0];
    }

    if (unowned.length > 0 && targetUser) {
      const targetId = targetUser._id;
      for (const p of unowned) {
        // تخطى الأماكن التي أُصلحت بالخطوة 1
        if (report.some(r => r.includes(p.name))) continue;
        await Place.collection.updateOne({ _id: p._id }, { $set: { ownerId: targetId } });
        report.push(`fixed(unowned): "${p.name}" → ${targetId} (${targetUser.name})`);
      }
    }

    const updated = await Place.find({ isActive: true }).lean();
    res.json({
      success: true,
      fixed: report.length,
      changes: report,
      targetUser: targetUser ? { name: targetUser.name, _id: targetUser._id, identifier: targetUser.identifier } : null,
      places: updated.map(p => ({ name: p.name, ownerId: String(p.ownerId) })),
      users: allUsers.map(u => ({ name: u.name, _id: u._id, identifier: u.identifier, role: u.role })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════
// 🔧 نقل أماكن بالإجبار لمستخدم محدد
// مثال: /api/admin/force-assign?targetIdentifier=07832373852
// ════════════════════════════════════════════════
router.get('/admin/force-assign', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      return res.json({ success: false, message: 'MongoDB غير متصل' });

    const { targetIdentifier } = req.query;
    if (!targetIdentifier)
      return res.json({ success: false, message: 'أرسل targetIdentifier في الـ query' });

    const targetUser = await User.findOne({ identifier: targetIdentifier }).lean();
    if (!targetUser)
      return res.json({ success: false, message: 'المستخدم غير موجود: ' + targetIdentifier });

    const targetId = targetUser._id;

    // خذ كل الأماكن التي ليست مملوكة لهذا المستخدم حالياً
    const toFix = await Place.find({
      isActive: true,
      ownerId: { $ne: targetId },
    }).lean();

    const report = [];
    for (const p of toFix) {
      await Place.findByIdAndUpdate(p._id, { ownerId: targetId });
      report.push(`"${p.name}" (${p.ownerId || 'no-owner'}) → ${targetId}`);
    }

    const finalPlaces = await Place.find({ isActive: true }).lean();
    res.json({
      success: true,
      message: `تم نقل ${report.length} مكان إلى ${targetUser.name}`,
      fixed: report.length,
      changes: report,
      targetUser: { name: targetUser.name, _id: targetId, identifier: targetUser.identifier },
      places: finalPlaces.map(p => ({ name: p.name, ownerId: String(p.ownerId) })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
