const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Block = require("../models/Block");
const Question = require("../models/Question");

// Legacy
router.post("/create", async (req, res) => {
  try {
    const { number, topic } = req.body;
    if (!Number.isInteger(number) || number < 1) return res.status(400).json({ message: "number düzgün deyil" });
    if (!topic?.trim()) return res.status(400).json({ message: "topic lazımdır" });

    const newBlock = new Block({ number, topic, position: 0 });
    await newBlock.save();
    res.json({ message: "✅ Blok əlavə edildi", block: newBlock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Blok yaratmaqda xəta" });
  }
});

// Yeni: idempotent
router.post("/create-by-topic", async (req, res) => {
  try {
    const { topicId, blockNumber } = req.body;
    if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({ message: "Yanlış topicId" });
    }
    if (!Number.isInteger(blockNumber) || blockNumber < 1) {
      return res.status(400).json({ message: "blockNumber düzgün deyil" });
    }

    const exists = await Block.findOne({ topicId, blockNumber }).lean();
    if (exists) return res.status(200).json({ item: exists, existed: true });

    const created = await Block.create({ topicId, blockNumber, number: blockNumber, position: 0 });
    const item = await Block.findById(created._id).lean();
    return res.status(201).json({ item, existed: false });
  } catch (e) {
    return res.status(500).json({ message: "Blok yaradıla bilmədi", detail: String(e?.message || e) });
  }
});

// reorder
router.put("/reorder", async (req, res) => {
  try {
    const { blocks } = req.body; // [{ _id, position }]
    if (!Array.isArray(blocks) || blocks.length === 0) return res.status(400).json({ message: "blocks boş ola bilməz" });

    const bulkOps = blocks.map((b) => ({ updateOne: { filter: { _id: b._id }, update: { position: b.position } } }));
    await Block.bulkWrite(bulkOps);
    res.json({ message: "✅ Sıralama yadda saxlanıldı" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Sıralama xətası" });
  }
});

// all
router.get("/", async (_req, res) => {
  try {
    const blocks = await Block.find();
    res.json(blocks);
  } catch {
    res.status(500).json({ message: "Bloklar tapılmadı" });
  }
});

// summary
router.get("/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Yanlış blok id" });

    const list = await Question.find({ blockId: id }).select("group type").lean();
    const hasOrnek = list.some((x) => x.group === "örnek" || x.type === "example");
    const hasOdev  = list.some((x) => x.group === "ev ödevi" || x.type === "homework");

    res.json({ hasOrnek, hasOdev, total: list.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Xülasə alınmadı" });
  }
});

// delete
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Yanlış blockId" });

    await Block.findByIdAndDelete(id);
    res.json({ message: "Blok silindi" });
  } catch (e) {
    res.status(500).json({ message: "Blok silinmədi" });
  }
});

module.exports = router;
