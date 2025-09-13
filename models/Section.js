// backend/models/Section.js
const mongoose = require("mongoose");
const slugify = require("../utils/slug");

const SectionSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    // Stabil id: isim değişse bile bu sabit; otomatik doldurulur
    key:   { type: String, required: true, trim: true, lowercase: true, immutable: true }
  },
  { timestamps: true }
);

// Otomatik key üret (name'den)
SectionSchema.pre("validate", function(next) {
  if (!this.key && this.name) {
    this.key = slugify(this.name);
  }
  next();
});

// indexler
SectionSchema.index({ order: 1 }, { unique: true });
SectionSchema.index({ key: 1 },   { unique: true });

module.exports = mongoose.model("Section", SectionSchema);