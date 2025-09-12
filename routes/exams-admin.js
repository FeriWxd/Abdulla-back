const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Exam = require("../models/Exam");
const ExamPaper = require("../models/ExamPaper");
const User = require("../models/User");

/* ---------- Helpers ---------- */
async function fanOutToStudents(examDoc) {
  const groups = examDoc.groupNames || [];
  if (!groups.length) return { students: 0, inserted: 0 };

  const students = await User.find(
    { role: "user", group: { $in: groups } },
    { _id: 1 }
  ).lean();
  if (!students.length) return { students: 0, inserted: 0 };

  const rows = students.map((s) => ({
    examId: examDoc._id,
    studentId: s._id,
    items: [], // sorular eklenince doldurulacak
    status: "assigned",
  }));

  let inserted = 0;
  try {
    const res = await ExamPaper.insertMany(rows, { ordered: false });
    inserted = Array.isArray(res) ? res.length : 0;
  } catch (e) {
    if (e?.code !== 11000) console.error("fanOutToStudents error:", e);
  }
  return { students: students.length, inserted };
}

/* ---------- CREATE ---------- */
router.post("/", async (req, res) => {
  try {
    const {
      title,
      classLevel,
      groupNames = [],
      startsAt,
      durationSec,
      parts = [],
      solutionsPdfUrl,
      publishNow = false,
    } = req.body;

    if (!Array.isArray(groupNames) || !groupNames.length) {
      return res.status(400).json({ message: "groupNames boş olamaz" });
    }

    const doc = await Exam.create({
      title,
      classLevel,
      groupNames,
      startsAt,
      durationSec,
      parts,
      solutionsPdfUrl,
      createdBy: req.user.id,
      isPublished: !!publishNow,
      status: publishNow ? "published" : "draft",
    });

    if (publishNow) {
      const fanout = await fanOutToStudents(doc);
      return res.json({ ok: true, exam: doc, fanout });
    }

    res.json({ ok: true, exam: doc });
  } catch (e) {
    console.error("Exam create error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server error" });
  }
});

/* ---------- Publish / Unpublish ---------- */
router.post("/:id/publish", async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: true, status: "published", startsAt: new Date() } },
      { new: true }
    );
    if (!exam) return res.status(404).json({ message: "Exam bulunamadı" });

    const fanout = await fanOutToStudents(exam);
    res.json({ ok: true, exam, fanout });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/:id/unpublish", async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: false, status: "draft" } },
      { new: true }
    );
    if (!exam) return res.status(404).json({ message: "Exam bulunamadı" });
    res.json({ ok: true, exam });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------- LIST ---------- */
router.get("/", async (req, res) => {
  try {
    const list = await Exam.find().sort({ createdAt: -1 }).lean();
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------- DETAIL ---------- */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Exam.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Exam bulunamadı" });
    res.json({ ok: true, exam: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------- DELETE ---------- */
router.delete("/:id", async (req, res) => {
  try {
    const del = await Exam.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ message: "Exam bulunamadı" });

    const epRes = await ExamPaper.deleteMany({ examId: req.params.id });
    res.json({ ok: true, deletedExamId: req.params.id, removedExamPapers: epRes.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
