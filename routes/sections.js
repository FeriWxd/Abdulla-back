const express = require("express");
const router = express.Router();
const Section = require("../models/Section");
const Topic = require("../models/Topic");

/* GET /api/sections */
router.get("/", async (_req, res) => {
  try {
    const items = await Section.find({}, "-__v").sort({ name: 1 }).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Sections alınmadı", error: String(err) });
  }
});

/* GET /api/sections/:id/topics */
router.get("/:id/topics", async (req, res) => {
  try {
    const sectionId = req.params.id;
    const items = await Topic.find({ sectionId }).sort({ order: 1, name: 1 }).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Topics alınmadı", error: String(err) });
  }
});

/* POST /api/sections */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name lazımdır" });
    }
    const exists = await Section.findOne({ name: name.trim() }).lean();
    if (exists) return res.status(400).json({ message: "Bu section artıq mövcuddur" });

    const doc = await Section.create({ name: name.trim() });
    res.status(201).json({ item: { _id: doc._id, name: doc.name } });
  } catch (err) {
    res.status(500).json({ message: "Section yaradıla bilmədi", error: String(err) });
  }
});

/* PUT /api/sections/:id */
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name lazımdır" });
    }
    const updated = await Section.findByIdAndUpdate(
      req.params.id,
      { $set: { name: name.trim() } },
      { new: true, select: "-__v" }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Section tapılmadı" });
    res.json({ item: updated });
  } catch (err) {
    res.status(500).json({ message: "Section yenilənmədi", error: String(err) });
  }
});

/* DELETE /api/sections/:id */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Section.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ message: "Section tapılmadı" });
    res.json({ message: "Silindi", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: "Silinmə xətası", error: String(err) });
  }
});

module.exports = router;
