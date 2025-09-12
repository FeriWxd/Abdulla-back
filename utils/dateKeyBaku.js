// backend/utils/dateKeyBaku.js
// Asia/Baku için YYYY-MM-DD anahtarı ve o güne göre saat üretimi

function todayKeyBaku() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Baku" }).slice(0, 10);
}

function atBaku(h = 6, m = 0) {
  const ymd = todayKeyBaku(); // "YYYY-MM-DD"
  // Asia/Baku'da ymd 00:00'ı baz alıp saat ekleme yaklaşımı
  const base = new Date(`${ymd}T00:00:00`);
  return new Date(base.getTime() + (h * 60 + m) * 60 * 1000);
}

module.exports = { todayKeyBaku, atBaku };
