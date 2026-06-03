// ════════════════════════════════════════════════════════════════
// Iraqi phone normalizer for ZainCash V2 (customer.phone field)
// ────────────────────────────────────────────────────────────────
// ZainCash يتطلب صيغة 9647xxxxxxxxx (13 رقم بدون +).
// نقبل أي شكل عراقي شائع ونحوله. لا نمنع شبكة معينة — ZainCash
// يرفض الشبكات غير المدعومة من جهته.
// ════════════════════════════════════════════════════════════════

function normalizeIraqiPhone(input) {
  if (!input) return null;

  // إزالة مسافات، شرطات، أقواس
  let phone = String(input).replace(/[\s\-()]/g, '');

  if (phone.startsWith('+964')) {
    phone = '964' + phone.substring(4);
  } else if (phone.startsWith('00964')) {
    phone = '964' + phone.substring(5);
  } else if (phone.startsWith('0')) {
    phone = '964' + phone.substring(1);
  } else if (!phone.startsWith('964')) {
    phone = '964' + phone;
  }

  // قبول كل الشبكات: 9647 + 9 أرقام = 13 رقم
  if (!/^9647\d{9}$/.test(phone)) return null;

  return phone;
}

module.exports = { normalizeIraqiPhone };
