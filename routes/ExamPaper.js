const mongoose = require("mongoose");
const { Schema } = mongoose;

const ExamPaperItemSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  partIndex: { type: Number, required: true }, // hangi parçaya ait
  status: { type: String, enum: ["todo", "done"], default: "todo" },
  answerOption: { type: String, enum: ["A", "B", "C", "D", "E", null], default: undefined },
  answerText: { type: String },
  answerNumeric: { type: Number },
  isCorrect: { type: Boolean, default: null },
  points: { type: Number, default: 1 },
  pointsEarned: { type: Number, default: 0 },
  answeredAt: { type: Date },
}, { _id: false });

const ExamPaperSchema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: "Exam", index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  items: [ExamPaperItemSchema],
  scorePart1: { type: Number, default: 0 },
  scorePart2: { type: Number, default: 0 },
  scorePart3: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  status: { type: String, enum: ["assigned", "in-progress", "completed"], default: "assigned" },
}, { timestamps: true });

ExamPaperSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("ExamPaper", ExamPaperSchema);
