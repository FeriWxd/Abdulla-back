// backend/utils/slug.js
module.exports = function slugify(input = "") {
  const map = {
    ə: "e", Ə: "e",
    ı: "i", I: "i",
    İ: "i",
    ş: "s", Ş: "s",
    ç: "c", Ç: "c",
    ğ: "g", Ğ: "g",
    ö: "o", Ö: "o",
    ü: "u", Ü: "u",
  };
  const replaced = input
    .split("")
    .map(ch => (map[ch] ? map[ch] : ch))
    .join("");

  return replaced
    .normalize("NFD").replace(/\p{Diacritic}/gu, "") // diacritics kaldır
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")  // boşluk ve özel karakter → -
    .replace(/^-+|-+$/g, "");     // baş/son tireleri sil
};