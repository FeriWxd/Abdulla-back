// backend/models/Assignment.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const AssignmentItemSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  points: { type: Number, default: 1 }, // her sorunun puanı
}, { _id: false });

const AssignmentSchema = new Schema({
  dateKey: { type: String, required: true },              // "YYYY-MM-DD" (Baku)
  title: { type: String, default: "Günlük Ödev" },
  instructions: { type: String, default: "" },
  groupNames: [{ type: String, required: true }],         // User.group dizisi (örn. "9-A")
  items: [AssignmentItemSchema],
  visibilityStartAt: { type: Date, required: true },      // öğrenciler görmeye bu tarihte başlar
  dueAt: { type: Date, required: true },                  // bu tarihten sonra cevap kabul edilmez
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

AssignmentSchema.index({ dateKey: 1, groupNames: 1 });
AssignmentSchema.index({ visibilityStartAt: 1, isPublished: 1 });
AssignmentSchema.index({ dueAt: 1 });

module.exports = mongoose.model("Assignment", AssignmentSchema);
