const mongoose = require('mongoose');

// ==============================
// نموذج الحجز
// ==============================
const bookingSchema = new mongoose.Schema(
  {
    placeId:   { type: String, required: true, index: true }, // ID المكان
    name:      { type: String, required: true },              // اسم الزبون
    phone:     { type: String, required: true },              // هاتف الزبون
    date:      { type: String, default: '' },                 // تاريخ الحجز
    time:      { type: String, default: '' },                 // وقت الحجز
    guests:    { type: Number, default: 2 },                  // عدد الأشخاص
    notes:     { type: String, default: '' },                 // ملاحظات
    // ─── حقول حجز الغرف (للفنادق) ───
    roomName:  { type: String, default: '' },                 // اسم/نوع الغرفة
    checkIn:   { type: String, default: '' },                 // تاريخ الدخول
    checkOut:  { type: String, default: '' },                 // تاريخ المغادرة
    nights:    { type: Number, default: 0 },                  // عدد الليالي
    status:    { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending' },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

bookingSchema.index({ placeId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
