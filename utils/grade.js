// backend/utils/grade.js
function qFormat(q) {
  return String(q?.questionFormat || q?.type || "").toLowerCase();
}

function normLetter(x) {
  if (x == null) return null;
  const s = String(x).trim().toUpperCase();
  return ["A", "B", "C", "D", "E"].includes(s) ? s : null;
}

function normMulti3(m) {
  const normArr = (arr) =>
    (Array.isArray(arr) ? Array.from(new Set(arr)) : [])
      .map((x) => String(x).toUpperCase())
      .filter((x) => ["A", "B", "C", "D", "E"].includes(x))
      .sort();
  return {
    s1: normArr(m?.s1),
    s2: normArr(m?.s2),
    s3: normArr(m?.s3),
  };
}

function hasKeyForMulti(q) {
  const m = q?.correctMulti || q?.multiCorrect || null;
  if (!m) return false;
  const M = normMulti3(m);
  return (M.s1.length + M.s2.length + M.s3.length) > 0;
}

function sameArray(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function gradeAnswer(qDoc, payload) {
  const fmt = qFormat(qDoc);

  // MULTI3
  if (fmt.includes("multi") || hasKeyForMulti(qDoc)) {
    const key = normMulti3(qDoc?.correctMulti || {});
    const given = normMulti3(payload?.answerMulti3 || {});
    const ok =
      sameArray(key.s1, given.s1) &&
      sameArray(key.s2, given.s2) &&
      sameArray(key.s3, given.s3);
    // anahtar yoksa ölçmeyelim
    const hasKey = (key.s1.length + key.s2.length + key.s3.length) > 0;
    return { isCorrect: hasKey ? !!ok : null };
  }

  // AÇIK UÇLU / SAYISAL
  if (fmt === "open" || qDoc?.numericAnswer != null) {
    const key = qDoc?.numericAnswer;
    if (key == null || String(key) === "") return { isCorrect: null };
    // hem metin hem sayı kabul: string karşılaştırma (trim) + sayısal karşılaştırma
    const givenText = (payload?.text ?? payload?.numeric ?? "").toString().trim();
    const keyText = key.toString().trim();
    if (givenText === keyText) return { isCorrect: true };

    const givenNum = Number(givenText.replace(",", "."));
    const keyNum = Number(keyText.replace(",", "."));
    if (Number.isFinite(givenNum) && Number.isFinite(keyNum)) {
      return { isCorrect: Math.abs(givenNum - keyNum) < 1e-9 };
    }
    return { isCorrect: false };
  }

  // TEST (tek şık)
  const keyLetter = normLetter(qDoc?.correctAnswer);
  if (!keyLetter) return { isCorrect: null };
  const given = normLetter(payload?.option);
  if (given == null) return { isCorrect: false };
  return { isCorrect: given === keyLetter };
}

module.exports = { gradeAnswer };
