// backend/routes/users.js
const express = require("express");
const router = express.Router();
const User = require("../models/User"); // <-- düzeltildi

// Tüm kullanıcılar (admin hariç)
router.get("/", async (_req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }, "-password -__v").lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Kullanıcılar alınamadı", error: String(error) });
  }
});

// Bir kullanıcının grubunu güncelle
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { group } = req.body;
    if (typeof group !== "string" || !group.trim()) {
      return res.status(400).json({ message: "Qrup dəyəri yanlışdır" });
    }
    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { group } },
      { new: true, select: "-password -__v" }
    ).lean();
    if (!updated) return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    res.json({ item: updated });
  } catch (error) {
    res.status(500).json({ message: "Server xətası", error: String(error) });
  }
});

/* 🆕 Gruplar özeti: /api/users/groups  */
router.get("/groups", async (_req, res) => {
  try {
    const items = await User.aggregate([
      { $match: { role: "user", group: { $ne: null } } },
      { $group: { _id: "$group", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ ok: true, items: items.map(i => ({ group: i._id, count: i.count })) });
  } catch (e) {
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

/* 🆕 Belirli bir grubun öğrencileri: /api/users/by-group?group=11/A */
router.get("/by-group", async (req, res) => {
  try {
    const { group } = req.query;
    if (!group) return res.status(400).json({ message: "group zorunlu" });
    const students = await User.find(
      { role: "user", group },
      { firstName: 1, lastName: 1, username: 1 }
    ).sort({ firstName: 1, lastName: 1 }).lean();
    res.json({ ok: true, items: students });
  } catch (e) {
    res.status(500).json({ message: "Sunucu hatası" });
  }
});

module.exports = router;
