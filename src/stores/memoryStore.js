// ─── مخزن مشترك للمستخدمين في الذاكرة (fallback بدون MongoDB) ───
const memoryUsers = new Map();
module.exports = { memoryUsers };
