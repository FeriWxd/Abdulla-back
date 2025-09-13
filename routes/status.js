// backend/routes/status.js
const express  = require("express");
const mongoose = require("mongoose");
const router   = express.Router();

const Status = require("../models/Status"); // ✅ doğru yol
const User   = require("../models/User");

// YYYY-MM-DD (Asia/Baku) – tarih gelmezse fallback
function dayKeyBaku() {
  let d = new Date(Date.now() + 4 * 60 * 60 * 1000); // UTC+4
  if (d.getUTCHours() < 4) d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// auth middleware'in bıraktığı kullanıcıyı yakalamak için ufak yardımcı
function getUserId(req, res) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    res?.locals?.user?._id ||
    res?.locals?.user?.id ||
    req.auth?.userId ||
    req.auth?.id ||
    null
  );
}

/* ------------------------------------------------------------------
 *  POST /api/status  → upsert (aynı gün/öğrenci için tek kayıt)
 * ------------------------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const {
      studentId,
      date,
      gecikti             = false,
      derseGelmedi        = false,
      defteriDuzensiz     = false,
      dersiDeftereYazmadi = false,
      odevYapilmamis      = false, // ✅ yeni
      basarili            = false,
    } = req.body;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ ok: false, message: "Geçersiz studentId" });
    }

    const day = (typeof date === "string" && date.length === 10) ? date : dayKeyBaku();

    const doc = await Status.findOneAndUpdate(
      { studentId, date: day },
      {
        $set: {
          gecikti:             !!gecikti,
          derseGelmedi:        !!derseGelmedi,
          defteriDuzensiz:     !!defteriDuzensiz,
          dersiDeftereYazmadi: !!dersiDeftereYazmadi,
          odevYapilmamis:      !!odevYapilmamis, // ✅
          basarili:            !!basarili,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, status: doc });
  } catch (e) {
    console.error("status upsert error", e);
    return res.status(500).json({ ok: false, message: "status save failed" });
  }
});

/* ------------------------------------------------------------------
 *  GET /api/status/by-group?group=...&date=YYYY-MM-DD
 *  (Yoklama tablosu için)
 * ------------------------------------------------------------------ */
router.get("/by-group", async (req, res) => {
  try {
    const group = String(req.query.group || "").trim();
    if (!group) return res.status(400).json({ ok: false, message: "group gerekli" });

    const day = (typeof req.query.date === "string" && req.query.date.length === 10)
      ? req.query.date
      : dayKeyBaku();

    const users = await User
      .find({ group })
      .select("_id firstName lastName username")
      .sort({ firstName: 1, lastName: 1 });

    const ids = users.map(u => u._id);
    const statuses = await Status.find({ studentId: { $in: ids }, date: day });

    const idx = new Map(statuses.map(s => [String(s.studentId), s]));

    const items = users.map(u => {
      const st = idx.get(String(u._id)) || null;
      return {
        studentId: String(u._id),
        fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        username: u.username || "",
        date: day,
        _id: st?._id || null,
        values: {
          gecikti:             !!st?.gecikti,
          derseGelmedi:        !!st?.derseGelmedi,
          defteriDuzensiz:     !!st?.defteriDuzensiz,
          dersiDeftereYazmadi: !!st?.dersiDeftereYazmadi,
          odevYapilmamis:      !!st?.odevYapilmamis, // ✅
          basarili:            !!st?.basarili,
        },
      };
    });

    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, date: day, items });
  } catch (e) {
    console.error("by-group error", e);
    return res.status(500).json({ ok: false, message: "by-group failed" });
  }
});

/* ------------------------------------------------------------------
 *  GET /api/status/me?limit=15
 *  (Profil – “Yoxlama Tarixi”)
 *  !!! BUNU /:studentId ÖNCESİNE KOY !!!
 * ------------------------------------------------------------------ */
router.get("/me", async (req, res) => {
  try {
    const uid = getUserId(req, res);
    if (!uid) return res.status(401).json({ ok: false, message: "auth required" });

    const raw   = parseInt(String(req.query.limit || ""), 10);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 1000) : 15;

    const items = await Status.find({ studentId: uid })
      .sort({ date: -1 })
      .limit(limit);

    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("GET /status/me error", e);
    return res.status(500).json({ ok: false, message: "status/me failed" });
  }
});

/* ------------------------------------------------------------------
 *  GET /api/status/:studentId  (öğrenci geçmişi)
 * ------------------------------------------------------------------ */
router.get("/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ ok: false, message: "Geçersiz studentId" });
    }

    const raw   = parseInt(String(req.query.limit || ""), 10);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 1000) : undefined;

    const q = Status.find({ studentId }).sort({ date: -1 });
    if (limit) q.limit(limit);
    const items = await q;

    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("history error", e);
    return res.status(500).json({ ok: false, message: "history failed" });
  }
});

module.exports = router;

