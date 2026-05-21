const mongoose = require('mongoose');

// ==============================
// نموذج المنيو (قائمة الأصناف)
// ==============================
const menuItemSchema = new mongoose.Schema({
  name:      { type: String, default: '' },
  description:{ type: String, default: '' },
  price:     { type: Number, default: 0 },       // اختياري — يُقبل 0
  category:  { type: String, default: 'عام' },
  image:     { type: String, default: '' },
  menuImage: { type: String, default: '' }        // صورة منيو كاملة
});

// ==============================
// نموذج التقييم
// ==============================
const reviewSchema = new mongoose.Schema({
  author: { type: String, required: true },       // اسم المراجع
  rating: { type: Number, required: true, min: 1, max: 5 }, // التقييم من 1 إلى 5
  comment: { type: String, default: '' },         // التعليق
  createdAt: { type: Date, default: Date.now }
});

// ==============================
// نموذج المكان الرئيسي
// ==============================
const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },     // اسم المكان
    type: {
      type: String,
      required: true,
      enum: ['مطعم', 'كافيه', 'فندق', 'مزرعة', 'سياحي', 'ترفيهي', 'cafe', 'restaurant', 'hotel'],
    },
    governorate: { type: String, default: 'البصرة' },        // المحافظة
    description: { type: String, default: '' },              // وصف المكان
    address: { type: String, default: '' },                  // العنوان
    phone: { type: String, default: '' },                    // رقم الهاتف
    openHours: { type: String, default: '9:00 ص - 11:00 م' }, // ساعات العمل
    priceRange: { type: String, default: 'متوسط' },          // النطاق السعري
    isFeatured: { type: Boolean, default: false },           // ظهور مميز (Premium)

    // مالك المكان — ObjectId مرتبط بالمستخدم (لا يتغير حتى بعد مسح بيانات التطبيق)
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },

    // الصور: مصفوفة نصوص URLs
    images: [{ type: String }],

    // موقع Google Maps: احداثيات أو رابط embed
    location: {
      lat: { type: Number, default: 30.5085 },     // خط العرض (البصرة افتراضياً)
      lng: { type: Number, default: 47.7833 },     // خط الطول
      mapUrl: { type: String, default: '' }        // رابط Google Maps embed
    },

    // المنيو
    menu: [menuItemSchema],

    // التقييمات
    reviews: [reviewSchema],

    // متوسط التقييم (يُحسب تلقائياً)
    averageRating: { type: Number, default: 0 },

    // حالة النشر
    isActive: { type: Boolean, default: true },

    // ─── حالة الموافقة من الأدمن ───
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, default: '' },

    // الميزات المتاحة
    features: [{ type: String }], // مثل: 'واي فاي', 'موقف سيارات', 'صالة عائلية'

    // المدينة / المنطقة
    area: { type: String, default: 'البصرة' },

    // ─── إحصائيات حقيقية (تتراكم تلقائياً) ───
    stats: {
      views:        { type: Number, default: 0 }, // عدد مرات فتح صفحة المكان
      bookings:     { type: Number, default: 0 }, // عدد الحجوزات
      reviewsCount: { type: Number, default: 0 }, // عدد التقييمات
    }
  },
  {
    timestamps: true // يضيف createdAt و updatedAt تلقائياً
  }
);

// ==============================
// دالة حساب متوسط التقييم قبل الحفظ
// ==============================
placeSchema.pre('save', async function () {
  if (this.reviews && this.reviews.length > 0) {
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.averageRating = Math.round((total / this.reviews.length) * 10) / 10;
  }
  // عدد التقييمات يبقى مطابقاً لطول مصفوفة التقييمات الفعلية
  if (!this.stats) this.stats = {};
  this.stats.reviewsCount = this.reviews ? this.reviews.length : 0;
});

// ==============================
// Index للبحث السريع
// ==============================
placeSchema.index({ type: 1, isActive: 1 });
placeSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Place', placeSchema);
