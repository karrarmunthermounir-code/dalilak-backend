const express = require('express');
const router = express.Router();
const {
  getAllPlaces,
  getPlaceById,
  addReview,
  getTypes,
  createPlace,
  deletePlace,
  updatePlace,
  createBooking,
  getBookingsForPlace,
  updateBookingStatus,
  getMyPlace,
} = require('../controllers/placesController');

const { protect, requireAdmin } = require('../middleware/auth');
const Place = require('../models/Place');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/sendPushNotification');

// ─── مسارات الأدمن (يجب أن تأتي قبل /:id لتجنب التعارض) ───
// GET /api/places/admin/pending — جلب الأماكن المعلقة
router.get('/admin/pending', protect, requireAdmin, async (req, res) => {
  try {
    const places = await Place.find({ status: 'pending', isActive: true })
      .populate('ownerId', 'name identifier')
      .sort('-createdAt');
    res.json({ success: true, places });
  } catch (err) {
    console.error('admin/pending error:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب الأماكن المعلقة' });
  }
});

// POST /api/places/admin/:id/approve — موافقة على مكان
router.post('/admin/:id/approve', protect, requireAdmin, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ success: false, message: 'غير موجود' });

    place.status = 'approved';
    place.reviewedBy = req.user._id;
    place.reviewedAt = new Date();
    await place.save();

    // إشعار Push لصاحب المكان (لا يحجب الاستجابة عند الفشل)
    if (place.ownerId) {
      User.findById(place.ownerId).select('fcmTokens').lean()
        .then(owner => {
          if (owner?.fcmTokens?.length) {
            return sendPushNotification({
              fcmTokens: owner.fcmTokens,
              title: '✅ تمت الموافقة!',
              body: `مكانك "${place.name}" أصبح ظاهراً للجميع`,
              data: { placeId: place._id.toString(), status: 'approved' },
            });
          }
        })
        .catch(err => console.error('approve push error:', err.message));
    }

    res.json({ success: true, message: 'تم الموافقة على المكان' });
  } catch (err) {
    console.error('admin/approve error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الموافقة' });
  }
});

// POST /api/places/admin/:id/reject — رفض مكان
router.post('/admin/:id/reject', protect, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ success: false, message: 'غير موجود' });

    place.status = 'rejected';
    place.rejectionReason = reason || 'لم يستوفِ الشروط';
    place.reviewedBy = req.user._id;
    place.reviewedAt = new Date();
    await place.save();

    // إشعار Push لصاحب المكان (لا يحجب الاستجابة عند الفشل)
    if (place.ownerId) {
      User.findById(place.ownerId).select('fcmTokens').lean()
        .then(owner => {
          if (owner?.fcmTokens?.length) {
            return sendPushNotification({
              fcmTokens: owner.fcmTokens,
              title: '❌ لم تتم الموافقة',
              body: `مكانك "${place.name}" — السبب: ${place.rejectionReason}`,
              data: { placeId: place._id.toString(), status: 'rejected' },
            });
          }
        })
        .catch(err => console.error('reject push error:', err.message));
    }

    res.json({ success: true, message: 'تم رفض المكان' });
  } catch (err) {
    console.error('admin/reject error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الرفض' });
  }
});

// ─── مسارات عامة (بدون تسجيل دخول) ───
// GET /api/places/types
router.get('/types', getTypes);

// GET /api/places — عرض كل الأماكن
router.get('/', getAllPlaces);

// GET /api/places/:id — تفاصيل مكان
router.get('/:id', getPlaceById);

// POST /api/places/:id/reviews — أي زائر يقدر يقيّم
router.post('/:id/reviews', addReview);

// ─── مسارات محمية (تتطلب تسجيل دخول) ───
// GET /api/places/my/:ownerId — جلب أماكن المستخدم
router.get('/my/:ownerId', protect, getMyPlace);

// POST /api/places — إضافة مكان (لازم مسجل دخول)
router.post('/', protect, createPlace);

// PUT /api/places/:id — تعديل مكان (فقط صاحبه)
router.put('/:id', protect, updatePlace);

// DELETE /api/places/:id — حذف مكان (فقط صاحبه)
router.delete('/:id', protect, deletePlace);

// ─── حجوزات ───
// POST /api/places/:id/bookings — زبون يحجز طاولة (بدون تسجيل)
router.post('/:id/bookings', createBooking);

// GET /api/places/:id/bookings — صاحب المكان يشوف الحجوزات (محمي)
router.get('/:id/bookings', protect, getBookingsForPlace);

// PUT /api/places/:id/bookings/:bookingId — صاحب المكان يأكد أو يرفض (محمي)
router.put('/:id/bookings/:bookingId', protect, updateBookingStatus);

module.exports = router;
