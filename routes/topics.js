const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Topic = require("../models/Topic");
const Block = require("../models/Block");
const Question = require("../models/Question");

/* Tüm konular */
router.get("/", async (_req, res) => {
  try {
    const items = await Topic.find({}).sort({ sectionId: 1, order: 1, name: 1 }).lean();
    res.json(items);
  } catch {
    res.status(500).json({ message: "Konular getirilemedi" });
  }
});

/* Konu oluştur */
router.post("/", async (req, res) => {
  try {
    const { sectionId, name, order } = req.body;

    if (!sectionId || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: "Yanlış sectionId" });
    }
    if (!name?.trim()) return res.status(400).json({ message: "Ad lazımdır" });
    if (!Number.isInteger(order) || order < 1) return res.status(400).json({ message: "order düzgün deyil" });

    const doc = await Topic.create({ sectionId, name: name.trim(), order });
    res.json(doc);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Bu bölümde bu order artıq var" });
    res.status(400).json({ message: e.message });
  }
});

/* Bir konunun blokları */
router.get("/:id/blocks", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Yanlış topicId" });
  }
  const blocks = await Block.find({ topicId: id }).sort({ blockNumber: 1 });
  res.json(blocks);
});

/* Konu patch */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Yanlış topicId" });

    const { name, sectionId, order } = req.body;

    const doc = await Topic.findById(id);
    if (!doc) return res.status(404).json({ message: "Konu tapılmadı" });

    const update = {};
    let targetSectionId = doc.sectionId;
    let targetOrder = doc.order;

    if (typeof name === "string" && name.trim()) update.name = name.trim();

    if (sectionId !== undefined) {
      if (!sectionId || !mongoose.Types.ObjectId.isValid(sectionId)) {
        return res.status(400).json({ message: "Yanlış sectionId" });
      }
      targetSectionId = sectionId;
      update.sectionId = sectionId;
    }

    if (order !== undefined) {
      if (!Number.isInteger(order) || order < 1) return res.status(400).json({ message: "order düzgün deyil" });
      targetOrder = order;
      update.order = order;
    }

    if (sectionId !== undefined && update.order === undefined) {
      const last = await Topic.find({ sectionId: targetSectionId }).sort({ order: -1 }).limit(1).lean();
      targetOrder = (last[0]?.order || 0) + 1;
      update.order = targetOrder;
    }

    if (update.order !== undefined) {
      const clash = await Topic.findOne({
        _id: { $ne: id },
        sectionId: targetSectionId,
        order: update.order,
      }).lean();
      if (clash) return res.status(409).json({ message: "Bu bölümde bu sıralama (order) zaten var" });
    }

    Object.assign(doc, update);
    await doc.save({ runValidators: true });
    res.json(doc);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Bu bölümde bu order artıq var" });
    res.status(400).json({ message: e.message || "Güncəlləmə xətası" });
  }
});

/* Konu sil (bloklar + sorular) */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Yanlış topicId" });

    const blocks = await Block.find({ topicId: id }, { _id: 1 }).lean();
    const blockIds = blocks.map((b) => b._id);

    if (blockIds.length) {
      await Question.deleteMany({ blockId: { $in: blockIds } });
      await Block.deleteMany({ _id: { $in: blockIds } });
    }

    await Topic.findByIdAndDelete(id);
    res.json({ message: "Konu və bağlı veriler silindi" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* Bölüm içi toplu sıralama */
router.put("/reorder", async (req, res) => {
  try {
    const { sectionId, items } = req.body;

    if (!sectionId || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ message: "Yanlış sectionId" });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "items boş ola bilməz" });
    }

    const orders = new Set();
    for (const it of items) {
      if (!mongoose.Types.ObjectId.isValid(it._id) || !Number.isInteger(it.order) || it.order < 1) {
        return res.status(400).json({ message: "Yanlış veri (id/order)" });
      }
      if (orders.has(it.order)) return res.status(409).json({ message: "Tekrarlanan order var" });
      orders.add(it.order);
    }

    const bulk = items.map((it) => ({
      updateOne: { filter: { _id: it._id, sectionId }, update: { order: it.order } },
    }));
    await Topic.bulkWrite(bulk);

    const updated = await Topic.find({ sectionId }).sort({ order: 1 }).lean();
    res.json({ message: "Sıralama güncellendi", topics: updated });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Bu bölümde order çakışması var" });
    res.status(400).json({ message: e.message || "Sıralama xətası" });
  }
});

module.exports = router;
