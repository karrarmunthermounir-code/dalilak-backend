const mongoose = require('mongoose');
const Place = require('../models/Place');
const User = require('../models/User');
const { admin } = require('../utils/firebase');
const sendAdminEmail = require('../utils/sendAdminEmail');
const { sendPushToAdmins } = require('../utils/sendPushNotification');

// ══════════════════════════════════════════
// ─── In-memory fallback عندما MongoDB غير متصل ───
// ══════════════════════════════════════════
const memoryPlaces = [];
const isDbConnected = () => mongoose.connection.readyState === 1;

// ==============================
// GET /api/places
// ==============================
const getAllPlaces = async (req, res) => {
  try {
    const { type, governorate, search, sort } = req.query;

    if (isDbConnected()) {
      const filter = { isActive: true, status: 'approved' };
      if (type && type !== 'الكل') filter.type = type;
      if (governorate && governorate !== 'الكل') filter.governorate = governorate;
      if (search) filter.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { governorate: new RegExp(search, 'i') },
        { area: new RegExp(search, 'i') },
      ];
      let sortOption = { isFeatured: -1, createdAt: -1 };
      if (sort === 'rating') sortOption = { isFeatured: -1, averageRating: -1 };
      if (sort === 'name') sortOption = { isFeatured: -1, name: 1 };
      const places = await Place.find(filter).select('-__v').sort(sortOption).lean();
      return res.json({ success: true, count: places.length, data: places });
    }

    // ─── Fallback: in-memory ───
    let result = memoryPlaces.filter(p => p.isActive);
    if (type && type !== 'الكل') result = result.filter(p => p.type === type);
    if (governorate && governorate !== 'الكل') result = result.filter(p => p.governorate === governorate);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    res.json({ success: true, count: result.length, data: result, source: 'memory' });
  } catch (error) {
    console.error('getAllPlaces error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات: ' + error.message });
  }
};

// ==============================
// GET /api/places/:id
// ==============================
const getPlaceById = async (req, res) => {
  try {
    if (isDbConnected()) {
      // زيادة عدّاد المشاهدات الحقيقي مع جلب المكان بنفس الطلب
      const place = await Place.findByIdAndUpdate(
        req.params.id,
        { $inc: { 'stats.views': 1 } },
        { new: true }
      ).lean();
      if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });
      return res.json({ success: true, data: place });
    }
    // Fallback
    const place = memoryPlaces.find(p => p._id === req.params.id);
    if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });
    place.stats = place.stats || { views: 0, bookings: 0, reviewsCount: 0 };
    place.stats.views = (place.stats.views || 0) + 1;
    res.json({ success: true, data: place });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
};

// ==============================
// POST /api/places
// ==============================
const createPlace = async (req, res) => {
  try {
    const { name, type, governorate, address, phone, openHours, description,
            images, imageFiles, menu, mapLink, features, isFeatured, ownerId } = req.body;
    if (!name || !type || !governorate) {
      return res.status(400).json({ success: false, message: 'الاسم والنوع والمحافظة مطلوبة' });
    }

    const placeData = {
      name, type, governorate,
      address: address || '',
      area: address || '',
      phone: phone || '',
      openHours: openHours || '',
      description: description || '',
      images: imageFiles?.length ? imageFiles : (images || []),
      menu: menu || [],
      mapLink: mapLink || '',
      features: features || [],
      isFeatured: !!isFeatured,
      // 🔑 المستخدم لازم يكون مسجل دخول — ownerId يجي دائماً من التوكن
      ownerId: req.user._id,
      isActive: true,
      status: 'pending',
    };

    if (isDbConnected()) {
      const place = new Place(placeData);
      await place.save();
      // اربط المكان بقائمة أماكن المستخدم — يدعم امتلاك أكثر من مكان
      await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { places: place._id } }
      );

      // إشعار الأدمن بالإيميل (لا يحجب الاستجابة عند الفشل)
      sendAdminEmail({
        placeName: place.name,
        placeType: place.type,
        ownerName: req.user.name,
        ownerEmail: req.user.identifier,
        placeId: place._id,
        description: place.description,
        address: place.address,
      }).catch(err => console.error('sendAdminEmail error:', err.message));

      // إشعار Push للأدمن (لا يحجب الاستجابة عند الفشل)
      sendPushToAdmins({
        title: '📍 مكان جديد للمراجعة',
        body: `${place.name} — من ${req.user.name}`,
        data: { placeId: place._id.toString(), action: 'review' },
      }).catch(err => console.error('sendPushToAdmins error:', err.message));

      return res.status(201).json({ success: true, data: place });
    }

    // ─── Fallback: in-memory ───
    const place = {
      ...placeData,
      _id: String(Date.now()),
      reviews: [],
      averageRating: 0,
      createdAt: new Date().toISOString(),
    };
    memoryPlaces.unshift(place);
    console.log(`📌 مكان جديد (memory): ${place.name} — المجموع: ${memoryPlaces.length}`);
    res.status(201).json({ success: true, data: place, source: 'memory' });
  } catch (error) {
    console.error('createPlace error:', error);
    res.status(500).json({ success: false, message: 'خطأ في حفظ المكان: ' + error.message });
  }
};

// ==============================
// DELETE /api/places/:id (مع التحقق من الملكية)
// ==============================
const deletePlace = async (req, res) => {
  try {
    if (isDbConnected()) {
      const place = await Place.findById(req.params.id);
      if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });

      // تحقق صارم من الملكية — فقط صاحب المكان يقدر يحذف
      if (!place.ownerId || !place.ownerId.equals(req.user._id)) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذا المكان' });
      }

      place.isActive = false;
      await place.save();
      return res.json({ success: true, message: 'تم حذف المكان' });
    }
    // Fallback
    const idx = memoryPlaces.findIndex(p => p._id === req.params.id);
    if (idx !== -1) memoryPlaces[idx].isActive = false;
    res.json({ success: true, message: 'تم حذف المكان' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المكان' });
  }
};

// ==============================
// POST /api/places/:id/reviews
// ==============================
const addReview = async (req, res) => {
  try {
    const { author, rating, comment } = req.body;
    if (!author || !rating) return res.status(400).json({ success: false, message: 'الاسم والتقييم مطلوبان' });
    if (rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'التقييم بين 1 و 5' });

    if (isDbConnected()) {
      const place = await Place.findById(req.params.id);
      if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });
      place.reviews.push({ author, rating: Number(rating), comment });
      await place.save();
      return res.status(201).json({ success: true, data: { reviews: place.reviews, averageRating: place.averageRating } });
    }
    // Fallback
    const place = memoryPlaces.find(p => p._id === req.params.id);
    if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });
    place.reviews.push({ author, rating: Number(rating), comment, createdAt: new Date().toISOString() });
    const total = place.reviews.reduce((sum, r) => sum + r.rating, 0);
    place.averageRating = Math.round((total / place.reviews.length) * 10) / 10;
    place.stats = place.stats || { views: 0, bookings: 0, reviewsCount: 0 };
    place.stats.reviewsCount = place.reviews.length;
    res.status(201).json({ success: true, data: { reviews: place.reviews, averageRating: place.averageRating } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة التقييم' });
  }
};

// ==============================
// GET /api/places/types
// ==============================
const getTypes = async (req, res) => {
  try {
    if (isDbConnected()) {
      const types = await Place.distinct('type', { isActive: true });
      return res.json({ success: true, data: ['الكل', ...types] });
    }
    // Fallback
    const types = [...new Set(memoryPlaces.filter(p => p.isActive).map(p => p.type))];
    res.json({ success: true, data: ['الكل', ...types] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الأنواع' });
  }
};

// ══════════════════════════════════════════
// ─── نظام الحجوزات (MongoDB + fallback) ───
// ══════════════════════════════════════════
const Booking = require('../models/Booking');
const memoryBookings = [];  // fallback فقط

// POST /api/places/:id/bookings — زبون يحجز
const createBooking = async (req, res) => {
  try {
    const { name, phone, date, time, guests, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, message: 'الاسم والهاتف مطلوبان' });

    let booking;

    if (isDbConnected()) {
      // ─── حفظ في MongoDB (دائم) ───
      const doc = new Booking({
        placeId: req.params.id,
        name, phone, date, time,
        guests: guests || 2,
        notes: notes || '',
        status: 'pending',
      });
      await doc.save();
      booking = doc.toObject();
    } else {
      // ─── Fallback: in-memory ───
      booking = {
        _id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
        placeId: req.params.id,
        name, phone, date, time,
        guests: guests || 2,
        notes: notes || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      memoryBookings.unshift(booking);
    }

    // أجلب اسم المكان + زِد عدّاد الحجوزات الحقيقي
    let place;
    if (isDbConnected()) {
      place = await Place.findByIdAndUpdate(
        req.params.id,
        { $inc: { 'stats.bookings': 1 } },
        { new: true }
      ).lean();
    } else {
      place = memoryPlaces.find(p => p._id === req.params.id);
      if (place) {
        place.stats = place.stats || { views: 0, bookings: 0, reviewsCount: 0 };
        place.stats.bookings = (place.stats.bookings || 0) + 1;
      }
    }
    console.log(`📌 حجز جديد: ${name} في ${place?.name || req.params.id}`);

    // ─── إرسال إشعار FCM لصاحب المكان ───
    if (place?.ownerId && isDbConnected() && admin.apps.length > 0) {
      try {
        const owner = await User.findOne({
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(place.ownerId) ? place.ownerId : null },
            { identifier: place.ownerId },
          ],
        });
        if (owner && owner.fcmTokens?.length > 0) {
          const notification = {
            title: '🔔 حجز جديد!',
            body: `${name} حجز طاولة في ${place.name} — ${date || 'بدون تاريخ'} ${time || ''}`,
          };
          const expiredIndexes = [];
          const sendResults = await Promise.allSettled(
            owner.fcmTokens.map((token, i) =>
              admin.messaging().send({
                token,
                notification,
                android: {
                  priority: 'high',
                  notification: {
                    ...notification,
                    sound: 'default',
                    channelId: 'booking_alerts',
                    icon: '@mipmap/ic_launcher',
                    color: '#1a6b45',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                  },
                },
                data: {
                  type: 'booking',
                  placeId: req.params.id,
                  bookingId: booking._id.toString(),
                  customerName: name,
                  customerPhone: phone,
                },
              }).catch(err => {
                if (err.code === 'messaging/registration-token-not-registered' ||
                    err.code === 'messaging/invalid-registration-token') {
                  expiredIndexes.push(i);
                }
                throw err;
              })
            )
          );
          if (expiredIndexes.length > 0) {
            owner.fcmTokens = owner.fcmTokens.filter((_, i) => !expiredIndexes.includes(i));
            await owner.save();
          }
          const sent = sendResults.filter(r => r.status === 'fulfilled').length;
          console.log(`🔔 إشعار FCM أُرسل لصاحب المكان: ${owner.name} (${sent}/${owner.fcmTokens.length + expiredIndexes.length})`);
        }
      } catch (notifErr) {
        console.warn('⚠️ خطأ في إرسال الإشعار:', notifErr.message);
      }
    }

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('createBooking error:', error);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء الحجز' });
  }
};

// GET /api/places/:id/bookings — صاحب المكان يشوف حجوزاته
const getBookingsForPlace = async (req, res) => {
  try {
    if (isDbConnected()) {
      const bookings = await Booking.find({ placeId: req.params.id }).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, count: bookings.length, data: bookings });
    }
    // Fallback
    const bookings = memoryBookings.filter(b => b.placeId === req.params.id);
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الحجوزات' });
  }
};

// PUT /api/places/:id/bookings/:bookingId — تأكيد أو إلغاء
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body; // confirmed | rejected | cancelled
    if (!['confirmed', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'الحالة لازم confirmed أو rejected أو cancelled' });
    }

    if (isDbConnected()) {
      const booking = await Booking.findOneAndUpdate(
        { _id: req.params.bookingId, placeId: req.params.id },
        { status },
        { new: true }
      ).lean();
      if (!booking) return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
      console.log(`📌 حجز ${status}: ${booking.name} في ${booking.placeId}`);
      return res.json({ success: true, data: booking });
    }

    // Fallback: in-memory
    const booking = memoryBookings.find(b => b._id === req.params.bookingId && b.placeId === req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'الحجز غير موجود' });

    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    console.log(`📌 حجز ${status}: ${booking.name} في ${booking.placeId}`);

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث الحجز' });
  }
};

// ==============================
// GET /api/places/my/:ownerId — جلب كل أماكن المستخدم بعد تسجيل الدخول
// ==============================
const getMyPlace = async (req, res) => {
  try {
    const { ownerId } = req.params;
    if (!ownerId) return res.status(400).json({ success: false, message: 'ownerId مطلوب' });

    if (isDbConnected()) {
      // 🔑 البحث بـ ObjectId — يضمن التطابق حتى بعد مسح بيانات التطبيق
      let places = [];
      if (mongoose.Types.ObjectId.isValid(ownerId)) {
        places = await Place.find({
          ownerId: new mongoose.Types.ObjectId(ownerId),
          isActive: true,
        }).lean();
      }

      if (places.length > 0) {
        return res.json({ success: true, data: places[0], places: places });
      }
    }

    // Fallback: in-memory
    const places = memoryPlaces.filter(p => String(p.ownerId) === ownerId && p.isActive);
    if (places.length > 0) {
      return res.json({ success: true, data: places[0], places: places });
    }

    res.json({ success: true, data: null, places: [] });
  } catch (error) {
    console.error('getMyPlace error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب مكان المستخدم' });
  }
};

// ==============================
// PUT /api/places/:id — تعديل المكان (مع التحقق من الملكية)
// ==============================
const updatePlace = async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id; // لا تحدّث الـ ID

    if (isDbConnected()) {
      const place = await Place.findById(req.params.id);
      if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });

      // تحقق صارم من الملكية — فقط صاحب المكان يقدر يعدل
      if (!place.ownerId || !place.ownerId.equals(req.user._id)) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل هذا المكان' });
      }

      // تطبيق التعديلات
      Object.assign(place, updates);
      await place.save();
      return res.json({ success: true, data: place.toObject() });
    }

    // Fallback
    const place = memoryPlaces.find(p => p._id === req.params.id);
    if (!place) return res.status(404).json({ success: false, message: 'المكان غير موجود' });
    Object.assign(place, updates);
    res.json({ success: true, data: place });
  } catch (error) {
    console.error('updatePlace error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث المكان' });
  }
};

module.exports = { getAllPlaces, getPlaceById, createPlace, deletePlace, updatePlace, addReview, getTypes, createBooking, getBookingsForPlace, updateBookingStatus, getMyPlace };
