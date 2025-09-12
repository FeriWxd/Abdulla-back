// backend/routes/questions.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const streamifier = require("streamifier");
const mongoose = require("mongoose");

const cloudinary = require("../utils/cloudinary");
const Question = require("../models/Question");
const Block = require("../models/Block");

/* Multer (memory) */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 12 },
});

const fields = upload.fields([
  { name: "questionImage", maxCount: 1 },
  { name: "solutionImage", maxCount: 1 },
  { name: "answerImage_A", maxCount: 1 },
  { name: "answerImage_B", maxCount: 1 },
  { name: "answerImage_C", maxCount: 1 },
  { name: "answerImage_D", maxCount: 1 },
  { name: "answerImage_E", maxCount: 1 },
]);

function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function normDifficulty(v) {
  const m = String(v || "").toLowerCase();
  return (
    {
      kolay: "easy",
      orta: "medium",
      "çətin": "hard",
      cetin: "hard",
      zor: "hard",
      hard: "hard",
      medium: "medium",
      easy: "easy",
    }[m] || "easy"
  );
}
function normCategory(v) {
  const m = String(v || "").toLowerCase();
  return { sayisal: "math", riyaziyyat: "math", math: "math", geometri: "geometry", geometry: "geometry" }[m] || "math";
}

/* ------------------ CREATE (upload) ------------------ */
router.post("/upload", fields, async (req, res) => {
  try {
    const {
      blockId,
      questionType,    // "test" | "open" | "multi3"
      difficulty,
      category,
      group,           // "örnek" | "ev ödevi"
      correctAnswer,   // test
      numericAnswer,   // open
      correctMulti,    // multi3 JSON
      topic,
      blockNumber,
      optionsEmbedded, // true/false
    } = req.body || {};

    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return res.status(400).json({ message: "blockId düzgün deyil" });
    }
    if (!["test", "open", "multi3"].includes(String(questionType))) {
      return res.status(400).json({ message: "questionType düzgün deyil" });
    }
    if (!["örnek", "ev ödevi"].includes(String(group))) {
      return res.status(400).json({ message: "group düzgün deyil" });
    }

    const blk = await Block.findById(blockId).lean();
    if (!blk) return res.status(404).json({ message: "Blok tapılmadı" });

    // Legacy gruplama (tek örnek/ödev kuralı)
    const legacyType = group === "örnek" ? "example" : "homework";
    const already = await Question.findOne({ blockId, type: legacyType }).lean();
    if (already) {
      return res.status(409).json({ message: `Bu blok için '${group}' sorusu zaten var` });
    }

    // Soru görseli
    const qFile = req.files?.questionImage?.[0];
    if (!qFile) return res.status(400).json({ message: "Sual şəkli tələb olunur" });
    const questionImageUrl = await uploadToCloudinary(qFile.buffer, "questions/question");

    const payload = {
      blockId,
      type: legacyType,
      group,
      questionFormat: questionType,
      difficulty: normDifficulty(difficulty),
      category: normCategory(category),
      imageUrl: questionImageUrl,
      answerImageUrl: null,
      answerImage_A: null,
      answerImage_B: null,
      answerImage_C: null,
      answerImage_D: null,
      answerImage_E: null,
      correctAnswer: undefined,
      numericAnswer: undefined,
      correctMulti: undefined,
      optionsEmbedded: false,
      topic: topic || blk?.topic || "legacy",
      blockNumber:
        Number.isInteger(parseInt(blockNumber, 10))
          ? parseInt(blockNumber, 10)
          : (blk?.blockNumber ?? blk?.number ?? 0),
    };

    const sFile = req.files?.solutionImage?.[0];
    if (sFile) payload.answerImageUrl = await uploadToCloudinary(sFile.buffer, "questions/solution");

    if (questionType === "test") {
      const embedded = String(optionsEmbedded) === "true" || optionsEmbedded === true;
      payload.optionsEmbedded = embedded;

      const ca = String(correctAnswer || "").toUpperCase();
      if (!["A", "B", "C", "D", "E"].includes(ca)) {
        return res.status(400).json({ message: "correctAnswer (A..E) düzgün deyil" });
      }
      payload.correctAnswer = ca;

      if (!embedded) {
        for (const L of ["A", "B", "C", "D", "E"]) {
          const f = req.files?.[`answerImage_${L}`]?.[0];
          if (!f) return res.status(400).json({ message: `Variant ${L} şəkli əksikdir` });
          payload[`answerImage_${L}`] = await uploadToCloudinary(f.buffer, `questions/answers/${L}`);
        }
      } else {
        for (const L of ["A", "B", "C", "D", "E"]) {
          const f = req.files?.[`answerImage_${L}`]?.[0];
          if (f) payload[`answerImage_${L}`] = await uploadToCloudinary(f.buffer, `questions/answers/${L}`);
        }
      }
    }

    if (questionType === "open") {
      const txt = String(numericAnswer ?? "").trim();
      if (!txt) return res.status(400).json({ message: "Açıq uçlu sual üçün dəqiq cavab lazımdır" });
      payload.numericAnswer = Number(txt);
    }

    if (questionType === "multi3") {
      let cm = correctMulti;
      if (typeof cm === "string") {
        try { cm = JSON.parse(cm); } catch { cm = {}; }
      }
      const norm = (arr) =>
        Array.isArray(arr)
          ? Array.from(new Set(arr.map(s => String(s).toUpperCase())))
              .filter(x => ["A","B","C","D","E"].includes(x))
              .slice(0, 2)
              .sort()
          : [];
      payload.correctMulti = { s1: norm(cm?.s1), s2: norm(cm?.s2), s3: norm(cm?.s3) };

      if (!payload.correctMulti.s1.length || !payload.correctMulti.s2.length || !payload.correctMulti.s3.length) {
        return res.status(400).json({ message: "multi3: her segment için en az 1 seçim gerekir" });
      }
      const all = [...payload.correctMulti.s1, ...payload.correctMulti.s2, ...payload.correctMulti.s3];
      if (new Set(all).size !== all.length) {
        return res.status(400).json({ message: "multi3: harfler segmentler arasında tekrar edemez" });
      }
    }

    const doc = await Question.create(payload);
    return res.status(201).json({ message: "Yükləndi", item: doc });
  } catch (err) {
    if (err?.name === "MulterError") {
      return res.status(400).json({ message: `Multer: ${err.code} ${err.field || ""}`.trim() });
    }
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Upload error:", err);
    return res.status(500).json({ message: "Internal Server Error", detail: String(err?.message || err) });
  }
});

/* ------------------ LIST ------------------ */
router.get("/", async (_req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 }).lean();
    res.json(questions);
  } catch {
    res.status(500).json({ message: "Server xətası" });
  }
});

/* ------------------ GET ONE (basic) ------------------ */
// Frontend tryFetchDetail() önce burayı dener.
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    const q = await Question.findById(id, {
      _id: 1,
      // soru görseli – farklı alan adlarını da tolere edelim
      imageUrl: 1,
      questionImage: 1,
      question_img: 1,
      // çözüm
      answerImageUrl: 1,
      answerImage: 1,
      solutionImage: 1,
      // test seçenek görselleri
      answerImage_A: 1,
      answerImage_B: 1,
      answerImage_C: 1,
      answerImage_D: 1,
      answerImage_E: 1,
      // doğru harf
      correctAnswer: 1,
      correct_option: 1,
      correctLetter: 1,
      correct_letter: 1,
      correct: 1,
      answer: 1,
      rightAnswer: 1,
      key: 1,
      answerKey: 1,
      // multi3 doğru set
      correctMulti: 1,
      s1: 1, s2: 1, s3: 1,
      // sayısal doğru cevap
      numericAnswer: 1,
      answerNumeric: 1,
      decimalAnswer: 1,
      answer_decimal: 1,
      exactAnswer: 1,
      exact_value: 1,
      decimal_value: 1,
      value: 1,
      trueAnswer: 1,
      true_answer: 1,
      // tip & format
      type: 1,
      questionFormat: 1,
      difficulty: 1,
      category: 1,
      // block bilgisi (id/numara – full için ayrıca bakacağız)
      blockId: 1,
      blockNumber: 1,
      topicId: 1,
    }).lean();

    if (!q) return res.status(404).json({ message: "Soru bulunamadı" });

    return res.json({ ok: true, item: q });
  } catch (e) {
    console.error("GET /questions/:id error", e);
    res.status(500).json({ message: e.message || "Sunucu hatası" });
  }
});

/* ------------------ GET ONE (full: +block) ------------------ */
router.get("/:id/full", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz id" });
    }

    const q = await Question.findById(id, {
      _id: 1,
      imageUrl: 1,
      questionImage: 1,
      question_img: 1,
      answerImageUrl: 1,
      answerImage: 1,
      solutionImage: 1,
      answerImage_A: 1,
      answerImage_B: 1,
      answerImage_C: 1,
      answerImage_D: 1,
      answerImage_E: 1,
      correctAnswer: 1,
      correct_option: 1,
      correctLetter: 1,
      correct_letter: 1,
      correct: 1,
      answer: 1,
      rightAnswer: 1,
      key: 1,
      answerKey: 1,
      correctMulti: 1,
      s1: 1, s2: 1, s3: 1,
      numericAnswer: 1,
      answerNumeric: 1,
      decimalAnswer: 1,
      answer_decimal: 1,
      exactAnswer: 1,
      exact_value: 1,
      decimal_value: 1,
      value: 1,
      trueAnswer: 1,
      true_answer: 1,
      type: 1,
      questionFormat: 1,
      difficulty: 1,
      category: 1,
      blockId: 1,
    }).lean();

    if (!q) return res.status(404).json({ message: "Soru bulunamadı" });

    let block = null;
    if (q.blockId) {
      const b = await Block.findById(q.blockId, { _id: 1, topicId: 1, blockNumber: 1 }).lean();
      if (b) block = b;
    }

    return res.json({ ok: true, item: { ...q, block } });
  } catch (e) {
    console.error("GET /questions/:id/full error", e);
    res.status(500).json({ message: e.message || "Sunucu hatası" });
  }
});

/* ------------------ DELETE ------------------ */
router.delete("/:id", async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ message: "Sual silindi" });
  } catch {
    res.status(500).json({ message: "Server xətası" });
  }
});

module.exports = router;
