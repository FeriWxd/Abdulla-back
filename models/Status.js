// backend/models/Status.js
const mongoose = require("mongoose");

const StatusSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    gecikti: { type: Boolean, default: false },
    derseGelmedi: { type: Boolean, default: false },
    defteriDuzensiz: { type: Boolean, default: false },
    dersiDeftereYazmadi: { type: Boolean, default: false },
    odevYapilmamis: { type: Boolean, default: false }, // ✅
    basarili: { type: Boolean, default: false },
  },
  { timestamps: true }
);

StatusSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Status", StatusSchema);