const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    status: { type: String, enum: ["todo", "done"], default: "todo" },

    // cevaplar
    answerOption: { type: String, enum: ["A", "B", "C", "D", "E", null], default: undefined },
    answerText: { type: String, default: undefined },
    answerNumeric: { type: Number, default: undefined },
    answerMulti3: {
      s1: [{ type: String, enum: ["A", "B", "C", "D", "E"] }],
      s2: [{ type: String, enum: ["A", "B", "C", "D", "E"] }],
      s3: [{ type: String, enum: ["A", "B", "C", "D", "E"] }],
    },

    // puanlama
    isCorrect: { type: Boolean, default: null },
    points: { type: Number, default: 1 },
    pointsEarned: { type: Number, default: 0 },

    attempts: { type: Number, default: 0 },
    answeredAt: { type: Date },
  },
  { _id: false }
);

const FinishSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    snapshotPercent: { type: Number, default: 0 },
  },
  { _id: false }
);

const StudentAssignmentSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    items: [ItemSchema],

    totalPoints: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    scorePercent: { type: Number, default: 0 }, // son bitiriş
    completedCount: { type: Number, default: 0 },
    status: { type: String, enum: ["assigned", "completed"], default: "assigned" },

    // tekrarlar
    finishes: { type: [FinishSchema], default: [] },
  },
  { timestamps: true }
);

StudentAssignmentSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("StudentAssignment", StudentAssignmentSchema);
