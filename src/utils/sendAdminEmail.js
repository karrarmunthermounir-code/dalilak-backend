const nodemailer = require('nodemailer');

let transporter = null;
const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_EMAIL_PASS) {
    console.warn('⚠️ ADMIN_EMAIL/ADMIN_EMAIL_PASS not set — admin emails disabled');
    return null;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_EMAIL_PASS,
    },
  });
  return transporter;
};

async function sendAdminEmail(data) {
  const t = getTransporter();
  if (!t) return;

  const adminEmail = process.env.ADMIN_EMAIL || 'karrar.munther.mounir@gmail.com';

  const html = `
    <div dir="rtl" style="font-family: Arial; padding: 20px;">
      <h2>📍 طلب إضافة مكان جديد</h2>
      <p><strong>اسم المكان:</strong> ${data.placeName}</p>
      <p><strong>النوع:</strong> ${data.placeType}</p>
      <p><strong>العنوان:</strong> ${data.address || 'غير محدد'}</p>
      <p><strong>الوصف:</strong> ${data.description || 'غير محدد'}</p>
      <hr>
      <p><strong>صاحب المكان:</strong> ${data.ownerName}</p>
      <p><strong>الإيميل/الهاتف:</strong> ${data.ownerEmail}</p>
      <hr>
      <p>افتح التطبيق وروح لصفحة Admin لمراجعة الطلب</p>
    </div>
  `;

  try {
    await t.sendMail({
      from: process.env.ADMIN_EMAIL,
      to: adminEmail,
      subject: `🏪 مكان جديد للمراجعة: ${data.placeName}`,
      html,
    });
    console.log('✅ Admin notification sent');
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

module.exports = sendAdminEmail;
