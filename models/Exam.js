const mongoose = require("mongoose");
const { Schema } = mongoose;

const ExamPartSchema = new Schema({
  index: { type: Number, required: true }, // 1,2,3
  format: { type: String, enum: ["test", "open"], required: true },
  questionsConfig: {
    math: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    geometry: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
  },
  negative025: { type: Boolean, default: false }, // test için -0.25
  scale: { type: Number, required: true },        // katsayı
}, { _id: false });

const ExamSchema = new Schema({
  title: { type: String, required: true },
  classLevel: { type: Number, enum: [9, 11], required: true }, // 9. sınıf, 11. sınıf
  groupNames: [{ type: String, required: true }],              // 9A, 9B, 11C vb.
  startsAt: { type: Date, required: true },                    // sınav başlangıcı
  durationSec: { type: Number, required: true },               // saniye cinsinden süre
  parts: [ExamPartSchema],                                     // parçalar
  solutionsPdfUrl: { type: String },                           // çözüm PDF
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isPublished: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },
}, { timestamps: true });

ExamSchema.index({ startsAt: 1, isPublished: 1 });

module.exports = mongoose.model("Exam", ExamSchema);
