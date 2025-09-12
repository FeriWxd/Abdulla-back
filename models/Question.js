// backend/models/Question.js
const mongoose = require("mongoose");

const LETTERS = ["A", "B", "C", "D", "E"];

const QuestionSchema = new mongoose.Schema(
  {
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", index: true },

    // Legacy
    topic: { type: String },
    blockNumber: { type: Number },

    // Zorunlu soru görseli
    imageUrl: { type: String, required: true },

    // Çözüm / genel cevap görseli (opsiyonel)
    answerImageUrl: { type: String },

    // Test şık görselleri (opsiyonel)
    answerImage_A: { type: String },
    answerImage_B: { type: String },
    answerImage_C: { type: String },
    answerImage_D: { type: String },
    answerImage_E: { type: String },

    // “örnek / ev ödevi” grubu (legacy)
    group: { type: String, enum: ["örnek", "ev ödevi"], index: true },

    // Legacy tip alanı (sadece uyumluluk için)
    type: {
      type: String,
      enum: ["example", "homework", "test", "open", "multi3"],
      index: true,
    },

    // Gerçek format
    questionFormat: {
      type: String,
      enum: ["test", "open", "multi3"],
      required: true,
      index: true,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
      index: true,
    },

    category: {
      type: String,
      enum: ["math", "geometry"],
      default: "math",
      index: true,
    },

    // test için
    correctAnswer: { type: String, enum: LETTERS, default: undefined },
    optionsEmbedded: { type: Boolean, default: false }, // şıklar resmin içinde mi?

    // open için
    numericAnswer: { type: Number, default: undefined },

    // multi3 için
    correctMulti: {
      s1: [String],
      s2: [String],
      s3: [String],
    },
  },
  { timestamps: true }
);

QuestionSchema.pre("validate", function (next) {
  if (typeof this.difficulty === "string") {
    const d = this.difficulty.toLowerCase();
    if (["kolay"].includes(d)) this.difficulty = "easy";
    else if (["orta", "medium"].includes(d)) this.difficulty = "medium";
    else if (["çətin", "cetin", "zor", "hard"].includes(d)) this.difficulty = "hard";
  }

  if (typeof this.category === "string") {
    const c = this.category.toLowerCase();
    if (["sayisal", "riyaziyyat", "math"].includes(c)) this.category = "math";
    else if (["geometri", "geometry"].includes(c)) this.category = "geometry";
  }

  const LETTERS = ["A", "B", "C", "D", "E"];
  const norm = (arr) =>
    Array.isArray(arr)
      ? Array.from(
          new Set(
            arr
              .map((x) => String(x || "").toUpperCase())
              .filter((x) => LETTERS.includes(x))
          )
        ).sort()
      : undefined;

  if (this.correctMulti) {
    if (this.correctMulti.s1) this.correctMulti.s1 = norm(this.correctMulti.s1);
    if (this.correctMulti.s2) this.correctMulti.s2 = norm(this.correctMulti.s2);
    if (this.correctMulti.s3) this.correctMulti.s3 = norm(this.correctMulti.s3);
  }

  if (!this.questionFormat && this.type && ["test", "open", "multi3"].includes(this.type)) {
    this.questionFormat = this.type;
  }

  next();
});

QuestionSchema.index({ blockId: 1, group: 1 }, { unique: true, sparse: true });
QuestionSchema.index({ blockId: 1, type: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Question", QuestionSchema);
