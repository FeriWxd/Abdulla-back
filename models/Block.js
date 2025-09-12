// models/Block.js
const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", index: true },
    blockNumber: { type: Number },

    // Legacy (compat)
    number: { type: Number },
    topic:  { type: String },

    position: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

blockSchema.index({ topicId: 1, blockNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Block", blockSchema);
