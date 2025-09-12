// backend/models/Topic.js
const mongoose = require("mongoose");
const slugify = require("../utils/slug");

const TopicSchema = new mongoose.Schema(
  {
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true, index: true },
    name:      { type: String, required: true, trim: true },
    order:     { type: Number, required: true },
    // Stabil id: otomatik; section içi benzersiz
    key:       { type: String, required: true, trim: true, lowercase: true, immutable: true }
  },
  { timestamps: true }
);

TopicSchema.pre("validate", function(next) {
  if (!this.key && this.name) {
    this.key = slugify(this.name);
  }
  next();
});

// Aynı section’da "order" benzersiz
TopicSchema.index({ sectionId: 1, order: 1 }, { unique: true });
// Aynı section’da "key" benzersiz (rename güvenli)
TopicSchema.index({ sectionId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Topic", TopicSchema);
