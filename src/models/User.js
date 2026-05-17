const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const subscriptionSchema = new mongoose.Schema({
  planId:      { type: String, default: 'free' },
  planName:    { type: String, default: 'مجاني' },
  status:      { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'inactive' },
  activatedAt: { type: Date },
  expiresAt:   { type: Date },
});

const statsSchema = new mongoose.Schema({
  placeId:  { type: String, required: true },
  views:    { type: Number, default: 0 },
  clicks:   { type: Number, default: 0 },
  favorites:{ type: Number, default: 0 },
  calls:    { type: Number, default: 0 },
  viewsHistory: [{ date: String, views: Number }],
}, { _id: false });

// ─── إعدادات المستخدم الدائمة ───
const settingsSchema = new mongoose.Schema({
  language:       { type: String, default: 'ar' },        // اللغة المفضلة
  notifications:  { type: Boolean, default: true },       // تفعيل الإشعارات
  darkMode:       { type: Boolean, default: true },        // الوضع الداكن
  defaultGov:     { type: String, default: 'البصرة' },     // المحافظة الافتراضية
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  identifier:  { type: String, required: true, unique: true, trim: true }, // email أو phone
  password:    { type: String, required: true }, // مخزّن كـ plain text (يمكن تشفيره لاحقاً)
  role:        { type: String, enum: ['user', 'owner', 'admin'], default: 'user' },
  avatar:      { type: String, default: '' },
  businessName: { type: String, default: '' },
  businessType: { type: String, default: '' },
  businessId:   { type: mongoose.Schema.Types.Mixed, default: null },
  subscription: { type: subscriptionSchema, default: () => ({}) },
  places:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Place' }], // أماكن يملكها المستخدم (يدعم أكثر من مكان)
  favorites:   [{ type: String }], // قائمة IDs الأماكن المفضلة
  stats:       [statsSchema],
  settings:    { type: settingsSchema, default: () => ({}) },  // إعدادات دائمة
  pushSubscriptions: [{ type: mongoose.Schema.Types.Mixed }], // اشتراكات Web Push
  fcmTokens:   [{ type: String }], // FCM tokens للإشعارات الحقيقية على Android
}, {
  timestamps: true,
});

// ─── تشفير كلمة المرور قبل الحفظ ───
userSchema.pre('save', async function () {
  // فقط إذا تم تعديل كلمة المرور
  if (!this.isModified('password')) return;
  // تخطي إذا كانت مشفرة مسبقاً (تبدأ بـ $2a$ أو $2b$)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── مقارنة كلمة المرور (تدعم القديمة غير المشفرة + الجديدة المشفرة) ───
userSchema.methods.comparePassword = async function (candidatePassword) {
  // إذا كلمة المرور مشفرة بـ bcrypt
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // fallback: مقارنة مباشرة للكلمات القديمة (plain text)
  // عند أول تسجيل دخول ناجح، سيتم تشفيرها
  return this.password === candidatePassword;
};

// ─── حساب tier الاشتراك ───
userSchema.virtual('tier').get(function () {
  const sub = this.subscription;
  if (!sub || sub.status !== 'active') return 'free';
  if (!sub.expiresAt || new Date(sub.expiresAt) < new Date()) return 'free';
  if (sub.planId === 'premium' || sub.planId === 'yearly') return 'premium';
  if (sub.planId === 'monthly_pro' || sub.planId === 'pro') return 'pro';
  return 'free';
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
