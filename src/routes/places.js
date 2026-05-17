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

const { protect } = require('../middleware/auth');

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
