const { Resend } = require('resend');

let _resend = null;
const getResend = () => {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — admin emails disabled');
    return null;
  }
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
};

async function sendAdminEmail(data) {
  const r = getResend();
  if (!r) return;

  const adminEmail = process.env.ADMIN_EMAIL || 'karrar.munther.mounir@gmail.com';
  const from       = process.env.EMAIL_FROM  || 'onboarding@resend.dev';

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
    const { data: sent, error } = await r.emails.send({
      from,
      to: adminEmail,
      subject: `🏪 مكان جديد للمراجعة: ${data.placeName}`,
      html,
    });
    if (error) throw new Error(error.message || 'Resend send failed');
    console.log(`✅ Admin notification sent (id=${sent?.id})`);
  } catch (err) {
    console.error('Resend admin email failed:', err.message);
  }
}

module.exports = sendAdminEmail;
