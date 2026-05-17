const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── JWT_SECRET: يجب أن يأتي من متغيرات البيئة فقط ───
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ خطأ حرج: JWT_SECRET غير موجود في متغيرات البيئة!');
  console.error('   أضفه في ملف .env أو في إعدادات Render');
  process.exit(1);
}

// ─── توليد JWT Token ───
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
};

// ─── Middleware للتحقق من الهوية ───
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة، سجّل دخولك مجدداً' });
    }

    // محاولة جلب المستخدم من MongoDB
    try {
      const user = await User.findById(decoded.id).select('-password');
      if (user) { req.user = user; return next(); }
    } catch {}

    // fallback: البحث في الذاكرة (عند عدم توفر MongoDB)
    const { memoryUsers } = require('../controllers/authController');
    if (memoryUsers) {
      for (const u of memoryUsers.values()) {
        if (u.id === decoded.id || u._id === decoded.id) {
          req.user = u;
          return next();
        }
      }
    }

    return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'خطأ في التحقق' });
  }
};

// ─── Middleware للتحقق من صلاحيات Admin ───
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ success: false, message: 'الوصول مرفوض — يتطلب صلاحيات مسؤول' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: 'التوكن غير صالح أو منتهي الصلاحية' });
    }

    // جلب المستخدم والتحقق من الدور
    const user = await User.findById(decoded.id).select('role name');
    if (!user) {
      return res.status(403).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.role !== 'admin') {
      console.warn(`⚠️ Admin access denied for: ${user.name} (role: ${user.role})`);
      return res.status(403).json({ success: false, message: 'الوصول مرفوض — يتطلب صلاحيات مسؤول' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'خطأ في التحقق من الصلاحيات' });
  }
};

// ─── Middleware للتحقق من الاشتراك ───
const requireSubscription = (tiers = ['pro', 'premium']) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'غير مصرح' });

    const sub = user.subscription;
    if (!sub || !sub.expiresAt || new Date(sub.expiresAt) < new Date()) {
      return res.status(403).json({ success: false, message: 'هذه الميزة تتطلب اشتراكاً مفعّلاً' });
    }

    const tier = ['premium', 'yearly'].includes(sub.planId) ? 'premium' :
                 ['pro', 'monthly_pro'].includes(sub.planId) ? 'pro' : 'free';

    if (!tiers.includes(tier)) {
      return res.status(403).json({ success: false, message: 'هذه الميزة تتطلب ترقية الاشتراك' });
    }

    req.userTier = tier;
    next();
  };
};

module.exports = { generateToken, protect, requireAdmin, requireSubscription, JWT_SECRET };
