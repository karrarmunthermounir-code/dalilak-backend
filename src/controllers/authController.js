const User     = require('../models/User');
const Place    = require('../models/Place');
const { generateToken } = require('../middleware/auth');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const bcrypt   = require('bcryptjs');
// ─── للتحقق من الدفع قبل تفعيل الاشتراك ───
const paymentRouter = require('../routes/payment');

// ─── مخزن في الذاكرة كـ fallback عند عدم توفر MongoDB ───
const memoryUsers = new Map();

// ─── مخزن مؤقت لرموز OTP ───
const otpStore = new Map(); // key: identifier, value: { code, expiresAt, attempts }

const isMongoConnected = () => mongoose.connection.readyState === 1;

// ─── إعداد Resend (HTTP API — يعمل على Render Free بدون SMTP) ───
let _resendClient = null;
let _resendReady  = null; // null=unknown, { ok:true }, { ok:false, code, message }
const getResendClient = () => {
  if (_resendClient) return _resendClient;
  if (!process.env.RESEND_API_KEY) {
    _resendReady = { ok: false, code: 'NO_API_KEY', message: 'RESEND_API_KEY not set' };
    console.warn('[Resend] RESEND_API_KEY not set — emails disabled (will log to console)');
    return null;
  }
  _resendClient = new Resend(process.env.RESEND_API_KEY);
  _resendReady  = { ok: true };
  console.log(`[Resend] Initialized — from=${process.env.EMAIL_FROM || 'onboarding@resend.dev'}`);
  return _resendClient;
};

// ─── تفعيل العميل عند بدء السيرفر (لتظهر السطر في logs فوراً) ───
getResendClient();

// ─── diagnostic: حالة الإيميل للـ /api/auth/email-status ───
const getEmailTransporterStatus = () => ({
  provider:   'resend',
  configured: !!process.env.RESEND_API_KEY,
  from:       process.env.EMAIL_FROM || 'onboarding@resend.dev',
  ready:      _resendReady,
});

// ─── helper: إرسال عبر Resend مع رمي خطأ موحّد ───
const _sendViaResend = async ({ to, subject, html }) => {
  const resend = getResendClient();
  if (!resend) return { sent: false, demo: true };
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const { data, error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    const err = new Error(error.message || 'Resend send failed');
    err.code = error.name || 'RESEND_ERROR';
    err.statusCode = error.statusCode;
    throw err;
  }
  return { sent: true, id: data?.id };
};

// ─── إرسال OTP بالإيميل (إعادة تعيين كلمة المرور) ───
const sendOtpEmail = async (email, otp) => {
  const result = await _sendViaResend({
    to: email,
    subject: '🔑 كود إعادة تعيين كلمة المرور — دليلك',
    html: `
      <div style="direction:rtl;font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#0d1f17;color:#e8f5ee;border-radius:16px;padding:32px;">
        <h2 style="color:#5dde8a;text-align:center;">🌴 دليلك</h2>
        <p style="font-size:16px;">مرحباً،</p>
        <p>استخدم الكود أدناه لإعادة تعيين كلمة مرورك:</p>
        <div style="background:#1a3a28;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#c9973a;">${otp}</span>
        </div>
        <p style="color:#8aaa96;font-size:14px;">⏰ الكود صالح لمدة <strong>10 دقائق</strong> فقط.</p>
        <p style="color:#8aaa96;font-size:14px;">إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>
        <hr style="border-color:#1a3a28;margin:24px 0;">
        <p style="text-align:center;color:#5a7a68;font-size:12px;">دليلك — تطبيق الأماكن العراقي</p>
      </div>
    `,
  }).catch((err) => { throw err; });

  if (result.demo) {
    console.log(`\n🔑 [OTP DEMO] البريد: ${email} — الكود: ${otp} — (10 دقائق)\n`);
  } else {
    console.log(`📧 [Resend] reset OTP sent to ${email} (id=${result.id})`);
  }
};

// ─── إرسال OTP تأكيد الحساب الجديد ───
const sendVerificationEmail = async (email, name, otp) => {
  const result = await _sendViaResend({
    to: email,
    subject: '🔐 رمز تفعيل حسابك في دليلك',
    html: `
      <div style="direction:rtl;font-family:Arial,'Segoe UI',sans-serif;max-width:520px;margin:auto;background:#0d1f17;color:#e8f5ee;border-radius:18px;padding:36px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:42px;">🌴</div>
          <h1 style="color:#5dde8a;margin:8px 0 0;font-size:24px;font-weight:900;">دليلك</h1>
        </div>
        <h2 style="color:#e8f5ee;font-size:18px;margin:0 0 6px;">مرحباً ${name || ''} 👋</h2>
        <p style="color:#bcd6c8;font-size:15px;line-height:1.7;margin:0 0 22px;">
          شكراً لتسجيلك في دليلك. لإكمال تفعيل حسابك، استخدم رمز التحقق التالي:
        </p>
        <div style="background:linear-gradient(135deg,#1a3a28 0%,#0d1f17 100%);border:1px solid rgba(93,222,138,0.25);border-radius:14px;padding:26px;text-align:center;margin:8px 0 24px;">
          <div style="color:#8aaa96;font-size:12px;letter-spacing:2px;margin-bottom:10px;">رمز التفعيل</div>
          <span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#c9973a;font-family:'Courier New',monospace;">${otp}</span>
        </div>
        <div style="background:rgba(201,151,58,0.08);border-right:3px solid #c9973a;border-radius:8px;padding:12px 16px;margin:0 0 18px;">
          <p style="color:#e8d4a8;font-size:13px;margin:0;line-height:1.6;">
            ⏰ صالح لمدة <strong>10 دقائق</strong> فقط<br>
            🔒 لا تشارك هذا الرمز مع أي شخص — فريق دليلك لن يطلبه منك أبداً
          </p>
        </div>
        <p style="color:#8aaa96;font-size:13px;line-height:1.7;margin:0 0 8px;">
          إذا لم تقم بإنشاء حساب في دليلك، تجاهل هذه الرسالة.
        </p>
        <hr style="border:none;border-top:1px solid rgba(93,222,138,0.12);margin:24px 0 14px;">
        <p style="text-align:center;color:#5a7a68;font-size:12px;margin:0;">
          للمساعدة: <a href="mailto:info@dalilak.app" style="color:#5dde8a;text-decoration:none;">info@dalilak.app</a>
        </p>
        <p style="text-align:center;color:#3d5a4d;font-size:11px;margin:6px 0 0;">
          دليلك — تطبيق الأماكن العراقي
        </p>
      </div>
    `,
  }).catch((err) => { throw err; });

  if (result.demo) {
    console.log(`\n🔐 [VERIFY OTP DEMO] ${name} <${email}> — الكود: ${otp} — (10 دقائق)\n`);
  } else {
    console.log(`📧 [Resend] verification OTP sent to ${email} (id=${result.id})`);
  }
};

// ─── توليد OTP ───
const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── إخفاء البريد الإلكتروني (k***@gmail.com) ───
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 1))}@${domain}`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmailIdentifier = (val) => EMAIL_RE.test(val);

// ─── الثوابت الزمنية لـ OTP تأكيد الحساب ───
const OTP_EXPIRES_MS         = 10 * 60 * 1000; // 10 دقائق
const RESEND_COOLDOWN_MS     = 60 * 1000;       // 60 ثانية بين كل resend
const MAX_VERIFY_ATTEMPTS    = 5;
const LOCKOUT_DURATION_MS    = 30 * 60 * 1000;  // 30 دقيقة

// ─── دالة مساعدة لإنشاء user من الذاكرة ───
function createMemoryUser({ name, identifier, password, role }) {
  const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  const user = {
    _id: id, id, name, identifier, password,
    role: role || 'user',
    avatar: name.charAt(0).toUpperCase(),
    businessName: '', businessType: '', businessId: null,
    subscription: {},
    favorites: [],
    stats: [],
    createdAt: new Date().toISOString(),
  };
  memoryUsers.set(identifier, user);
  return user;
}

function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ─── تسجيل مستخدم جديد ───
// 🔐 إيميل → isVerified:false + إرسال OTP، لا يُرجَع token
// 📱 هاتف   → isVerified:true (SMS OTP غير مفعّل بعد)، يُرجَع token مباشرة
const register = async (req, res) => {
  try {
    const { name, identifier, password, role } = req.body;

    if (!name || !identifier || !password)
      return res.status(400).json({ success: false, message: 'الاسم والمعرّف وكلمة المرور مطلوبة' });

    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'كلمة المرور 6 أحرف على الأقل' });

    const idTrim = identifier.trim();
    const isEmail = isEmailIdentifier(idTrim);

    let userId, userObj;

    if (isMongoConnected()) {
      const exists = await User.findOne({ identifier: idTrim });
      if (exists) return res.status(400).json({ success: false, message: 'هذا الحساب مسجّل مسبقاً' });

      const userData = {
        name: name.trim(), identifier: idTrim, password,
        role: role || 'user', avatar: name.trim().charAt(0).toUpperCase(),
        isVerified: !isEmail, // إيميل → false (يحتاج OTP)، هاتف → true
      };

      // ─── إيميل: ولّد OTP وأرسله ───
      if (isEmail) {
        const otp = generateOTP();
        userData.verificationOtp        = otp;
        userData.verificationOtpExpires = new Date(Date.now() + OTP_EXPIRES_MS);
        userData.verificationLastSentAt = new Date();
        userData.verificationAttempts   = 0;

        const user = await User.create(userData);
        try {
          await sendVerificationEmail(idTrim, user.name, otp);
          console.log(`📧 Verification OTP sent to: ${idTrim}`);
        } catch (mailErr) {
          // فشل إرسال الإيميل → نحذف الحساب لتجنب حساب معلّق
          await User.deleteOne({ _id: user._id });
          console.error('sendVerificationEmail error:', mailErr.code, '-', mailErr.message);
          return res.status(500).json({
            success: false,
            message: 'تعذّر إرسال رمز التأكيد، حاول لاحقاً',
            // ─── diagnostic (لا يكشف credentials) ───
            errorCode:    mailErr.code || null,
            errorMessage: mailErr.message || null,
            errorHint: mailErr.code === 'EAUTH'              ? 'بيانات اعتماد البريد خاطئة'
                     : mailErr.code === 'ETIMEDOUT'          ? 'انتهت مهلة الاتصال (port محجوب)'
                     : mailErr.code === 'ECONNECTION'        ? 'تعذّر الاتصال بخادم البريد'
                     : mailErr.code === 'validation_error'   ? 'Resend في وضع التجربة: تستطيع الإرسال فقط لإيميل حساب Resend. تحقّق من custom domain.'
                     : mailErr.code === 'RESEND_ERROR'       ? 'فشل Resend API — تحقق من المفتاح / from domain'
                     : mailErr.code === 'NO_API_KEY'         ? 'RESEND_API_KEY غير مضبوط'
                     : null,
          });
        }

        return res.status(201).json({
          success: true,
          needsVerification: true,
          identifier: idTrim,
          maskedEmail: maskEmail(idTrim),
          message: 'تم إرسال رمز التأكيد إلى بريدك الإلكتروني',
        });
      }

      // ─── هاتف: لا OTP، token مباشرة ───
      const user = await User.create(userData);
      userId  = user._id;
      userObj = {
        id: user._id, name: user.name, identifier: user.identifier,
        role: user.role, avatar: user.avatar,
        businessName: user.businessName, businessId: user.businessId,
        subscription: {}, favorites: [],
      };
    } else {
      // Fallback: الذاكرة
      if (memoryUsers.has(idTrim))
        return res.status(400).json({ success: false, message: 'هذا الحساب مسجّل مسبقاً' });

      const user = createMemoryUser({ name: name.trim(), identifier: idTrim, password, role });

      if (isEmail) {
        // في وضع الذاكرة (بدون MongoDB)، نخزّن OTP على object المستخدم
        const otp = generateOTP();
        user.isVerified              = false;
        user.verificationOtp         = otp;
        user.verificationOtpExpires  = Date.now() + OTP_EXPIRES_MS;
        user.verificationLastSentAt  = Date.now();
        user.verificationAttempts    = 0;
        memoryUsers.set(idTrim, user);

        try {
          await sendVerificationEmail(idTrim, user.name, otp);
          console.log(`📧 Verification OTP (memory) sent to: ${idTrim}`);
        } catch (mailErr) {
          memoryUsers.delete(idTrim);
          console.error('sendVerificationEmail error:', mailErr);
          return res.status(500).json({ success: false, message: 'تعذّر إرسال رمز التأكيد، حاول لاحقاً' });
        }

        return res.status(201).json({
          success: true,
          needsVerification: true,
          identifier: idTrim,
          maskedEmail: maskEmail(idTrim),
          message: 'تم إرسال رمز التأكيد إلى بريدك الإلكتروني',
        });
      }

      // هاتف في الذاكرة
      user.isVerified = true;
      memoryUsers.set(idTrim, user);
      userId  = user.id;
      userObj = sanitizeUser(user);
    }

    const token = generateToken(userId);
    res.status(201).json({ success: true, token, user: userObj });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── التحقق من OTP وتفعيل الحساب الجديد ───
const verifyOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp)
      return res.status(400).json({ success: false, message: 'البريد والرمز مطلوبان' });

    const id = identifier.trim();
    const code = String(otp).trim();

    if (isMongoConnected()) {
      const user = await User.findOne({ identifier: id });
      if (!user) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

      // إذا الحساب مفعّل أصلاً
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: 'الحساب مفعّل مسبقاً، سجّل دخولك' });
      }

      // تحقق من القفل
      if (user.verificationLockedUntil && user.verificationLockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.verificationLockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          locked: true,
          message: `الحساب مقفل مؤقتاً، حاول بعد ${minutesLeft} دقيقة`,
          unlocksAt: user.verificationLockedUntil,
        });
      }

      // تحقق من انتهاء صلاحية OTP
      if (!user.verificationOtp || !user.verificationOtpExpires || user.verificationOtpExpires < new Date()) {
        return res.status(400).json({
          success: false,
          expired: true,
          message: 'انتهت صلاحية الرمز، اطلب رمزاً جديداً',
        });
      }

      // تحقق من تطابق OTP
      if (user.verificationOtp !== code) {
        user.verificationAttempts = (user.verificationAttempts || 0) + 1;
        const attemptsLeft = MAX_VERIFY_ATTEMPTS - user.verificationAttempts;

        if (user.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
          user.verificationLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          user.verificationOtp         = null;
          user.verificationOtpExpires  = null;
          user.verificationAttempts    = 0;
          await user.save();
          return res.status(429).json({
            success: false,
            locked: true,
            message: 'تجاوزت عدد المحاولات، الحساب مقفل 30 دقيقة',
            unlocksAt: user.verificationLockedUntil,
          });
        }

        await user.save();
        return res.status(400).json({
          success: false,
          message: `رمز غير صحيح، تبقى ${attemptsLeft} محاولات`,
          attemptsLeft,
        });
      }

      // ─── النجاح: فعّل الحساب وأصدر token ───
      user.isVerified              = true;
      user.verificationOtp         = null;
      user.verificationOtpExpires  = null;
      user.verificationAttempts    = 0;
      user.verificationLockedUntil = null;
      await user.save();

      const userObj = {
        id: user._id, name: user.name, identifier: user.identifier,
        role: user.role, avatar: user.avatar,
        businessName: user.businessName, businessId: user.businessId,
        subscription: user.subscription || {}, favorites: user.favorites || [],
        settings: user.settings || {},
      };
      const token = generateToken(user._id);
      console.log(`✅ Account verified: ${id}`);
      return res.json({ success: true, token, user: userObj, places: [] });
    }

    // ─── Fallback: الذاكرة ───
    const u = memoryUsers.get(id);
    if (!u) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    if (u.isVerified) return res.status(400).json({ success: false, message: 'الحساب مفعّل مسبقاً، سجّل دخولك' });

    if (u.verificationLockedUntil && u.verificationLockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((u.verificationLockedUntil - Date.now()) / 60000);
      return res.status(429).json({ success: false, locked: true, message: `الحساب مقفل، حاول بعد ${minutesLeft} دقيقة` });
    }
    if (!u.verificationOtp || !u.verificationOtpExpires || u.verificationOtpExpires < Date.now()) {
      return res.status(400).json({ success: false, expired: true, message: 'انتهت صلاحية الرمز' });
    }
    if (u.verificationOtp !== code) {
      u.verificationAttempts = (u.verificationAttempts || 0) + 1;
      const attemptsLeft = MAX_VERIFY_ATTEMPTS - u.verificationAttempts;
      if (u.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
        u.verificationLockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        u.verificationOtp = null; u.verificationAttempts = 0;
        memoryUsers.set(id, u);
        return res.status(429).json({ success: false, locked: true, message: 'تجاوزت المحاولات، الحساب مقفل 30 دقيقة' });
      }
      memoryUsers.set(id, u);
      return res.status(400).json({ success: false, message: `رمز غير صحيح، تبقى ${attemptsLeft} محاولات`, attemptsLeft });
    }

    u.isVerified = true;
    u.verificationOtp = null; u.verificationOtpExpires = null;
    u.verificationAttempts = 0; u.verificationLockedUntil = null;
    memoryUsers.set(id, u);
    const token = generateToken(u.id);
    return res.json({ success: true, token, user: sanitizeUser(u), places: [] });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── إعادة إرسال OTP ───
const resendOtp = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'البريد مطلوب' });

    const id = identifier.trim();

    if (isMongoConnected()) {
      const user = await User.findOne({ identifier: id });
      if (!user) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
      if (user.isVerified) return res.status(400).json({ success: false, message: 'الحساب مفعّل مسبقاً' });

      // تحقق من القفل
      if (user.verificationLockedUntil && user.verificationLockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.verificationLockedUntil - Date.now()) / 60000);
        return res.status(429).json({ success: false, locked: true, message: `الحساب مقفل، حاول بعد ${minutesLeft} دقيقة` });
      }

      // cooldown 60 ثانية
      if (user.verificationLastSentAt) {
        const elapsed = Date.now() - new Date(user.verificationLastSentAt).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const secondsUntilNextResend = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return res.status(429).json({
            success: false,
            message: `انتظر ${secondsUntilNextResend} ثانية قبل إعادة الإرسال`,
            secondsUntilNextResend,
          });
        }
      }

      const otp = generateOTP();
      user.verificationOtp        = otp;
      user.verificationOtpExpires = new Date(Date.now() + OTP_EXPIRES_MS);
      user.verificationLastSentAt = new Date();
      user.verificationAttempts   = 0; // resend يصفر المحاولات
      await user.save();

      try {
        await sendVerificationEmail(id, user.name, otp);
        console.log(`📧 Verification OTP RESENT to: ${id}`);
      } catch (mailErr) {
        console.error('sendVerificationEmail error:', mailErr.code, '-', mailErr.message);
        return res.status(500).json({
          success: false,
          message: 'تعذّر إرسال الرمز، حاول لاحقاً',
          errorCode:    mailErr.code || null,
          errorMessage: mailErr.message || null,
        });
      }

      return res.json({ success: true, message: 'تم إرسال رمز جديد', secondsUntilNextResend: 60 });
    }

    // ─── Fallback: الذاكرة ───
    const u = memoryUsers.get(id);
    if (!u) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    if (u.isVerified) return res.status(400).json({ success: false, message: 'الحساب مفعّل مسبقاً' });

    if (u.verificationLockedUntil && u.verificationLockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((u.verificationLockedUntil - Date.now()) / 60000);
      return res.status(429).json({ success: false, locked: true, message: `الحساب مقفل، حاول بعد ${minutesLeft} دقيقة` });
    }
    if (u.verificationLastSentAt) {
      const elapsed = Date.now() - u.verificationLastSentAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const secondsUntilNextResend = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ success: false, message: `انتظر ${secondsUntilNextResend} ثانية`, secondsUntilNextResend });
      }
    }

    const otp = generateOTP();
    u.verificationOtp = otp;
    u.verificationOtpExpires = Date.now() + OTP_EXPIRES_MS;
    u.verificationLastSentAt = Date.now();
    u.verificationAttempts = 0;
    memoryUsers.set(id, u);

    try {
      await sendVerificationEmail(id, u.name, otp);
    } catch (mailErr) {
      console.error('sendVerificationEmail error:', mailErr);
      return res.status(500).json({ success: false, message: 'تعذّر إرسال الرمز' });
    }
    return res.json({ success: true, message: 'تم إرسال رمز جديد', secondsUntilNextResend: 60 });
  } catch (err) {
    console.error('resendOtp error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── تسجيل الدخول ───
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password)
      return res.status(400).json({ success: false, message: 'المعرّف وكلمة المرور مطلوبان' });

    let userObj, userId;

    if (isMongoConnected()) {
      const user = await User.findOne({ identifier: identifier.trim() });
      if (!user) return res.status(401).json({ success: false, message: 'الحساب غير موجود' });

      // ─── مقارنة آمنة بـ bcrypt (تدعم القديمة والجديدة) ───
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });

      // ─── 🔐 رفض الحسابات غير المفعّلة (إيميل بدون تأكيد OTP) ───
      // ملاحظة: المستخدمون القدامى بدون حقل isVerified يُعاملون كمفعّلين (isVerified === undefined)
      if (user.isVerified === false) {
        const id = user.identifier;
        const isEmail = isEmailIdentifier(id);
        return res.status(403).json({
          success: false,
          needsVerification: true,
          identifier: id,
          maskedEmail: isEmail ? maskEmail(id) : id,
          message: 'حسابك غير مفعّل، تحقق من بريدك الإلكتروني',
        });
      }

      // ─── ترقية كلمات المرور القديمة (plain text → bcrypt) ───
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        console.log(`🔐 Password upgraded to bcrypt for: ${user.identifier}`);
      }

      const sub = user.subscription;
      const isActive = sub && sub.expiresAt && new Date(sub.expiresAt) > new Date();
      const tier = isActive ? (['premium', 'yearly'].includes(sub.planId) ? 'premium' : 'pro') : 'free';

      userId  = user._id;
      userObj = {
        id: user._id, name: user.name, identifier: user.identifier,
        role: user.role, avatar: user.avatar,
        businessName: user.businessName, businessId: user.businessId,
        favorites: user.favorites,
        settings: user.settings || {},
        subscription: isActive ? { ...sub.toObject(), active: true, tier, daysLeft: Math.ceil((new Date(sub.expiresAt) - new Date()) / 864e5) }
                                : { active: false, tier: 'free' },
      };
    } else {
      // Fallback: الذاكرة
      const user = memoryUsers.get(identifier.trim());
      if (!user) return res.status(401).json({ success: false, message: 'الحساب غير موجود' });
      if (user.password !== password) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });

      userId  = user.id;
      const sub = user.subscription || {};
      const isActive = sub.expiresAt && new Date(sub.expiresAt) > new Date();
      userObj = {
        ...sanitizeUser(user),
        subscription: isActive ? { ...sub, active: true } : { active: false, tier: 'free' },
      };
    }

    // ─── جلب أماكن المستخدم مباشرةً مع الـ Login ───
    let myPlaces = [];
    if (isMongoConnected()) {
      // 🔑 بحث بـ ObjectId فقط — المصدر الوحيد للملكية
      myPlaces = await Place.find({
        ownerId: userId,
        isActive: true,
      }).lean();
    }

    const token = generateToken(userId);
    res.json({ success: true, token, user: userObj, places: myPlaces });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── جلب بيانات المستخدم الحالي ───
const getMe = async (req, res) => {
  try {
    const user = req.user; // من middleware
    const sub = (user.subscription && typeof user.subscription.toObject === 'function')
      ? user.subscription.toObject() : (user.subscription || {});
    const isActive = sub.expiresAt && new Date(sub.expiresAt) > new Date();
    const tier = isActive ? (['premium', 'yearly'].includes(sub.planId) ? 'premium' : 'pro') : 'free';

    res.json({
      success: true,
      user: {
        id: user._id || user.id,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        avatar: user.avatar,
        businessName: user.businessName || '',
        businessId: user.businessId || null,
        favorites: user.favorites || [],
        settings: user.settings || {},
        subscription: isActive
          ? { ...sub, active: true, tier, daysLeft: Math.ceil((new Date(sub.expiresAt) - new Date()) / 864e5) }
          : { active: false, tier: 'free' },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── تحديث بيانات المستخدم ───
const updateProfile = async (req, res) => {
  try {
    const { name, businessName, businessType } = req.body;

    if (isMongoConnected()) {
      const updates = {};
      if (name) updates.name = name.trim();
      if (businessName !== undefined) updates.businessName = businessName;
      if (businessType !== undefined) updates.businessType = businessType;
      const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
      res.json({ success: true, user });
    } else {
      // fallback: تحديث في الذاكرة
      for (const [key, u] of memoryUsers.entries()) {
        if (u.id === String(req.user._id || req.user.id)) {
          if (name) u.name = name.trim();
          if (businessName !== undefined) u.businessName = businessName;
          if (businessType !== undefined) u.businessType = businessType;
          memoryUsers.set(key, u);
          res.json({ success: true, user: sanitizeUser(u) });
          return;
        }
      }
      res.json({ success: true, user: req.user });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في التحديث' });
  }
};

// ─── تبديل المفضلة ───
const toggleFavorite = async (req, res) => {
  try {
    const { placeId } = req.body;
    let favorites, added;

    if (isMongoConnected()) {
      const user = await User.findById(req.user._id);
      const idx = user.favorites.indexOf(placeId);
      if (idx === -1) { user.favorites.push(placeId); added = true; }
      else { user.favorites.splice(idx, 1); added = false; }
      await user.save();
      favorites = user.favorites;
    } else {
      // fallback: الذاكرة
      for (const [key, u] of memoryUsers.entries()) {
        if (u.id === String(req.user._id || req.user.id)) {
          const idx = u.favorites.indexOf(placeId);
          if (idx === -1) { u.favorites.push(placeId); added = true; }
          else { u.favorites.splice(idx, 1); added = false; }
          memoryUsers.set(key, u);
          favorites = u.favorites;
          break;
        }
      }
      if (!favorites) favorites = [];
    }

    res.json({ success: true, favorites, added });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في المفضلة' });
  }
};

// ─── تفعيل الاشتراك ───
// 🔒 تحقق صارم من الدفع: لا يقبل أي خطة مدفوعة بدون orderId صالح من callback ZainCash.
// الاستثناء الوحيد: free_trial (تجربة مجانية لمرة واحدة لكل مستخدم).
const activateSubscription = async (req, res) => {
  try {
    const { planId, planName, orderId } = req.body;
    const DURATIONS = { free_trial: 30, monthly_pro: 30, pro: 30, premium: 365, yearly: 365 };

    // ─── خطط مجانية (مسموح بدون orderId) ───
    const FREE_PLANS = ['free_trial'];
    const isFreePlan = FREE_PLANS.includes(planId);

    // ─── إذا الخطة مدفوعة: لازم orderId صالح من callback ZainCash ───
    let paidOrder = null;
    if (!isFreePlan) {
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تفعيل اشتراك مدفوع بدون إثبات دفع (orderId مفقود)',
        });
      }
      paidOrder = paymentRouter.consumePaidOrder(orderId);
      if (!paidOrder) {
        return res.status(402).json({
          success: false,
          message: 'لم نتمكن من التحقق من الدفع. إذا تم خصم المبلغ، تواصل مع الدعم.',
        });
      }
      // تأكد إن planId المُرسَل يطابق الخطة المدفوعة (لا يقدر يدفع شهري ويفعّل سنوي)
      if (paidOrder.planId && paidOrder.planId !== planId) {
        return res.status(400).json({
          success: false,
          message: 'الخطة المطلوبة لا تطابق الخطة المدفوعة',
        });
      }
    }

    // ─── منع تفعيل free_trial مرتين لنفس المستخدم ───
    if (isFreePlan && isMongoConnected()) {
      const existing = await User.findById(req.user._id).select('subscription');
      if (existing?.subscription?.planId === 'free_trial' && existing.subscription.activatedAt) {
        return res.status(403).json({
          success: false,
          message: 'لقد استخدمت التجربة المجانية مسبقاً',
        });
      }
    }

    const days = DURATIONS[planId] || 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 864e5);
    const tier = 'premium'; // كل الخطط تمنح كل المميزات

    const subObj = { planId, planName, status: 'active', activatedAt: now, expiresAt };
    if (paidOrder) {
      console.log(`💰 Subscription activated for ${req.user.identifier} via paid order: ${orderId} (${planId})`);
    } else {
      console.log(`🎁 Free trial activated for ${req.user.identifier}`);
    }

    if (isMongoConnected()) {
      await User.findByIdAndUpdate(req.user._id, { subscription: subObj });
    } else {
      // fallback: الذاكرة
      for (const [key, u] of memoryUsers.entries()) {
        if (u.id === String(req.user._id || req.user.id)) {
          u.subscription = subObj;
          memoryUsers.set(key, u);
          break;
        }
      }
    }

    res.json({
      success: true,
      subscription: { ...subObj, active: true, tier, daysLeft: days },
    });
  } catch (err) {
    console.error('activateSubscription error:', err);
    res.status(500).json({ success: false, message: 'خطأ في تفعيل الاشتراك' });
  }
};

// ─── جلب الإحصائيات الحقيقية من أماكن المستخدم ───
const getStats = async (req, res) => {
  try {
    const userId  = String(req.user._id || req.user.id);
    const placeId = req.params.placeId;

    // إحصائيات فارغة (صفر) — لا أرقام عشوائية
    const emptyStats = (pid) => ({
      placeId: pid || 'all',
      views: 0, clicks: 0, favorites: 0, calls: 0, bookings: 0, reviewsCount: 0,
      viewsHistory: Array.from({ length: 7 }, (_, i) => ({
        date:  new Date(Date.now() - (6 - i) * 864e5).toLocaleDateString('ar-IQ'),
        views: 0,
      })),
    });

    if (!isMongoConnected()) {
      // بدون قاعدة بيانات لا توجد بيانات حقيقية — نُرجع أصفاراً بدل أرقام مزيّفة
      return res.json({ success: true, stats: emptyStats(placeId) });
    }

    // اجمع كل أماكن المستخدم النشطة (يدعم أكثر من مكان)
    const ownerFilter = { ownerId: req.user._id, isActive: true };
    if (placeId && mongoose.Types.ObjectId.isValid(placeId)) {
      ownerFilter._id = new mongoose.Types.ObjectId(placeId);
    }
    const places = await Place.find(ownerFilter)
      .select('_id stats reviews')
      .lean();

    if (!places.length) {
      return res.json({ success: true, stats: emptyStats(placeId) });
    }

    const placeIds = places.map(p => String(p._id));
    // عدد المستخدمين الذين أضافوا أحد هذه الأماكن للمفضلة
    const favorites = await User.countDocuments({ favorites: { $in: placeIds } });

    const totals = places.reduce((acc, p) => {
      const s = p.stats || {};
      acc.views    += s.views || 0;
      acc.bookings += s.bookings || 0;
      acc.reviewsCount += (s.reviewsCount != null ? s.reviewsCount : (p.reviews?.length || 0));
      return acc;
    }, { views: 0, bookings: 0, reviewsCount: 0 });

    const stats = {
      placeId: placeId || 'all',
      views:        totals.views,
      bookings:     totals.bookings,
      reviewsCount: totals.reviewsCount,
      calls:        totals.bookings, // نقرات الاتصال الحقيقية المتوفرة = الحجوزات
      clicks:       totals.views,
      favorites,
      // لا يوجد تتبّع يومي للمشاهدات بعد — نُرجع آخر 7 أيام بأصفار بدل أرقام عشوائية
      viewsHistory: Array.from({ length: 7 }, (_, i) => ({
        date:  new Date(Date.now() - (6 - i) * 864e5).toLocaleDateString('ar-IQ'),
        views: i === 6 ? totals.views : 0,
      })),
    };

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في الإحصائيات' });
  }
};

// ─── طلب OTP لإعادة تعيين كلمة المرور ───
const requestPasswordReset = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'أدخل البريد الإلكتروني أو رقم الموبايل' });

    const id = identifier.trim();

    // تحقق من وجود المستخدم
    let exists = false;
    if (isMongoConnected()) {
      const user = await User.findOne({ identifier: id });
      exists = !!user;
    } else {
      exists = memoryUsers.has(id);
    }

    if (!exists) {
      return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    }

    // تحقق من طلب سابق (منع الإرسال المتكرر قبل دقيقة)
    const existing = otpStore.get(id);
    if (existing && existing.expiresAt - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ success: false, message: 'تم إرسال كود مسبقاً، انتظر دقيقة قبل إعادة الإرسال' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 دقائق
    otpStore.set(id, { code: otp, expiresAt, attempts: 0 });

    // تحديد نوع المعرّف
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const isPhone = /^07[3-9]\d{8}$/.test(id);

    if (isEmail) {
      await sendOtpEmail(id, otp);
      console.log(`📧 OTP sent to email: ${id}`);
    } else if (isPhone) {
      // SMS — في الوقت الحالي يُعرض في الـ console (تحتاج SMS provider مثل Twilio)
      console.log(`\n📱 [OTP SMS] رقم: ${id} — الكود: ${otp} — (10 دقائق)\n`);
    }

    // 🔒 devOtp يُرجَع فقط في التطوير المحلي (لا أبداً في الإنتاج)
    const isDev = process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER;
    res.json({
      success: true,
      message: isEmail ? 'تم إرسال الكود إلى بريدك الإلكتروني' : 'تم إرسال الكود إلى رقمك عبر SMS',
      method: isEmail ? 'email' : 'sms',
      // 🔒 في وضع التطوير المحلي فقط — لا يُرسَل أبداً في الإنتاج (NODE_ENV=production)
      devOtp: isDev ? otp : undefined,
    });
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── التحقق من OTP وإعادة تعيين كلمة المرور ───
const resetPassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword)
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'كلمة المرور 6 أحرف على الأقل' });

    const id = identifier.trim();
    const stored = otpStore.get(id);

    if (!stored) {
      return res.status(400).json({ success: false, message: 'لم يتم طلب كود لهذا الحساب، أو انتهت صلاحيته' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(id);
      return res.status(400).json({ success: false, message: 'انتهت صلاحية الكود، اطلب كوداً جديداً' });
    }

    // تحديد عدد المحاولات (حد أقصى 5)
    stored.attempts += 1;
    if (stored.attempts > 5) {
      otpStore.delete(id);
      return res.status(429).json({ success: false, message: 'تجاوزت عدد المحاولات، اطلب كوداً جديداً' });
    }

    if (stored.code !== otp.trim()) {
      return res.status(400).json({ success: false, message: `الكود غير صحيح، تبقى ${5 - stored.attempts} محاولة` });
    }

    // الكود صحيح — حذفه وتحديث كلمة المرور
    otpStore.delete(id);

    if (isMongoConnected()) {
      // ─── تشفير كلمة المرور الجديدة قبل الحفظ ───
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await User.findOneAndUpdate({ identifier: id }, { password: hashedPassword });
    } else {
      const user = memoryUsers.get(id);
      if (user) { user.password = newPassword; memoryUsers.set(id, user); }
    }

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ─── حفظ اشتراك Push Notification ───
const savePushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'بيانات الاشتراك غير صحيحة' });
    }

    if (isMongoConnected()) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

      // تأكد إن الاشتراك ما موجود مسبقاً
      const exists = user.pushSubscriptions?.some(s => s.endpoint === subscription.endpoint);
      if (!exists) {
        user.pushSubscriptions = user.pushSubscriptions || [];
        user.pushSubscriptions.push(subscription);
        await user.save();
      }
      return res.json({ success: true, message: 'تم تفعيل الإشعارات' });
    }

    // fallback: الذاكرة
    for (const [key, u] of memoryUsers.entries()) {
      if (u.id === String(req.user._id || req.user.id)) {
        u.pushSubscriptions = u.pushSubscriptions || [];
        const exists = u.pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
        if (!exists) u.pushSubscriptions.push(subscription);
        memoryUsers.set(key, u);
        break;
      }
    }
    res.json({ success: true, message: 'تم تفعيل الإشعارات' });
  } catch (err) {
    console.error('savePushSubscription error:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ الاشتراك' });
  }
};

// ─── حفظ FCM Token (إشعارات Android الحقيقية) ───
const saveFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ success: false, message: 'التوكن غير صحيح' });
    }

    if (isMongoConnected()) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

      // تأكد إن التوكن ما موجود مسبقاً
      if (!user.fcmTokens?.includes(fcmToken)) {
        user.fcmTokens = user.fcmTokens || [];
        user.fcmTokens.push(fcmToken);
        await user.save();
      }
      console.log(`📱 FCM token saved for: ${user.name}`);
      return res.json({ success: true, message: 'تم تفعيل إشعارات الموبايل' });
    }

    res.json({ success: true, message: 'تم تفعيل إشعارات الموبايل (محلياً)' });
  } catch (err) {
    console.error('saveFcmToken error:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ التوكن' });
  }
};

// ─── إرجاع مفتاح VAPID العام ───
const getVapidKey = (req, res) => {
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BNhjdzcSNnjTeVfmRS0eBYrtbzIvamiClqWoKW3XA85M33pKaK66keSGOkhnJduUK5qGdWBrjE_eQEU9lVaBMsg';
  res.json({ success: true, publicKey: VAPID_PUBLIC });
};

// ════════════════════════════════════════════════
// ─── جلب كل بيانات المستخدم (استعادة كاملة) ───
// ════════════════════════════════════════════════
const getMyData = async (req, res) => {
  try {
    const user = req.user;
    const userId = String(user._id || user.id);

    // 1. بيانات المستخدم الأساسية
    const sub = (user.subscription && typeof user.subscription.toObject === 'function')
      ? user.subscription.toObject() : (user.subscription || {});
    const isActive = sub.expiresAt && new Date(sub.expiresAt) > new Date();
    const tier = isActive ? (['premium', 'yearly'].includes(sub.planId) ? 'premium' : 'pro') : 'free';

    const userData = {
      id: userId,
      name: user.name,
      identifier: user.identifier,
      role: user.role,
      avatar: user.avatar,
      businessName: user.businessName || '',
      businessId: user.businessId || null,
      favorites: user.favorites || [],
      settings: user.settings || {},
      subscription: isActive
        ? { ...sub, active: true, tier, daysLeft: Math.ceil((new Date(sub.expiresAt) - new Date()) / 864e5) }
        : { active: false, tier: 'free' },
    };

    // 2. جلب كل أماكن المستخدم من قاعدة البيانات
    let myPlaces = [];
    if (isMongoConnected()) {
      // 🔑 بحث بـ ObjectId فقط — المصدر الوحيد للملكية
      myPlaces = await Place.find({
        ownerId: userId,
        isActive: true,
      }).lean();
    }

    res.json({
      success: true,
      user: userData,
      places: myPlaces,
    });
  } catch (err) {
    console.error('getMyData error:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
};

// ─── حفظ إعدادات المستخدم ───
const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'إعدادات غير صحيحة' });
    }

    if (isMongoConnected()) {
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { settings },
        { new: true }
      ).select('-password');
      return res.json({ success: true, settings: user.settings });
    }

    // fallback: الذاكرة
    for (const [key, u] of memoryUsers.entries()) {
      if (u.id === String(req.user._id || req.user.id)) {
        u.settings = settings;
        memoryUsers.set(key, u);
        return res.json({ success: true, settings });
      }
    }

    res.json({ success: true, settings });
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ الإعدادات' });
  }
};

module.exports = { register, login, verifyOtp, resendOtp, getMe, updateProfile, toggleFavorite, activateSubscription, getStats, requestPasswordReset, resetPassword, savePushSubscription, getVapidKey, saveFcmToken, getMyData, updateSettings, getEmailTransporterStatus };
