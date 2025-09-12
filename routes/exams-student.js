const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Exam = require("../models/Exam");
const ExamPaper = require("../models/ExamPaper");
const Question = require("../models/Question");
const { gradeAnswer } = require("../utils/grade"); // zaten assignments'ta var

/* -------- Aktif sınav kutusu -------- */
router.get("/active", async (req, res) => {
  try {
    const studentId = req.user.id;
    const now = new Date();

    const paper = await ExamPaper.findOne({ studentId })
      .populate("examId")
      .sort({ createdAt: -1 })
      .lean();

    if (!paper) return res.json({ ok: true, exam: null });

    const exam = paper.examId;
    if (!exam?.isPublished) return res.json({ ok: true, exam: null });

    const endTime = new Date(new Date(exam.startsAt).getTime() + exam.durationSec * 1000);
    if (now < new Date(exam.startsAt) || now > endTime) {
      return res.json({ ok: true, exam: null });
    }

    res.json({
      ok: true,
      exam: {
        id: exam._id,
        title: exam.title,
        startsAt: exam.startsAt,
        durationSec: exam.durationSec,
        remainingSec: Math.max(0, Math.floor((endTime - now) / 1000)),
        paperId: paper._id,
        status: paper.status,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* -------- Sınavı başlat -------- */
router.post("/:paperId/start", async (req, res) => {
  try {
    const studentId = req.user.id;
    const paperId = req.params.paperId;

    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ message: "Geçersiz paperId" });
    }

    const paper = await ExamPaper.findOne({ _id: paperId, studentId }).populate("examId");
    if (!paper) return res.status(404).json({ message: "ExamPaper bulunamadı" });

    const exam = paper.examId;
    if (!exam?.isPublished) return res.status(403).json({ message: "Sınav yayınlanmadı" });

    paper.startedAt = new Date();
    paper.status = "in-progress";
    await paper.save();

    res.json({ ok: true, paperId: paper._id });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* -------- Cevap gönder -------- */
router.post("/:paperId/answer", async (req, res) => {
  try {
    const studentId = req.user.id;
    const { paperId } = req.params;
    const { questionId, answerOption, answerText, answerNumeric } = req.body;

    const paper = await ExamPaper.findOne({ _id: paperId, studentId });
    if (!paper) return res.status(404).json({ message: "Paper bulunamadı" });

    const item = paper.items.find((x) => String(x.questionId) === String(questionId));
    if (!item) return res.status(404).json({ message: "Soru bulunamadı" });

    if (answerOption) item.answerOption = answerOption;
    if (typeof answerText === "string") item.answerText = answerText;
    if (typeof answerNumeric === "number") item.answerNumeric = answerNumeric;

    item.status = "done";
    item.answeredAt = new Date();

    const qDoc = await Question.findById(questionId).lean();
    const payload = answerOption ? { option: answerOption } :
                   typeof answerNumeric === "number" ? { numeric: answerNumeric } :
                   { text: answerText };

    const g = gradeAnswer(qDoc, payload);
    item.isCorrect = g.isCorrect ?? null;
    item.pointsEarned = g.isCorrect ? (item.points || 1) : 0;

    await paper.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* -------- Sınavı bitir -------- */
router.post("/:paperId/finish", async (req, res) => {
  try {
    const studentId = req.user.id;
    const { paperId } = req.params;

    const paper = await ExamPaper.findOne({ _id: paperId, studentId }).populate("examId");
    if (!paper) return res.status(404).json({ message: "Paper bulunamadı" });

    const exam = paper.examId;
    if (!exam) return res.status(404).json({ message: "Exam bulunamadı" });

    let correct1 = 0, wrong1 = 0;
    let correct2 = 0;
    let correct3 = 0;

    for (const it of paper.items || []) {
      if (it.partIndex === 1) {
        if (it.isCorrect) correct1++;
        else if (it.status === "done") wrong1++;
      }
      if (it.partIndex === 2 && it.isCorrect) correct2++;
      if (it.partIndex === 3 && it.isCorrect) correct3++;
    }

    // puanlama kuralları
    const parts = exam.parts || [];
    const scale1 = parts[0]?.scale || 1;
    const scale2 = parts[1]?.scale || 1;
    const scale3 = parts[2]?.scale || 1;
    const negative = parts[0]?.negative025 || false;

    let result1 = correct1 + (negative ? wrong1 * -0.25 : 0);
    if (result1 < 0) result1 = 0;
    paper.scorePart1 = result1 * scale1;
    paper.scorePart2 = correct2 * scale2;
    paper.scorePart3 = correct3 * scale3;

    paper.totalScore = paper.scorePart1 + paper.scorePart2 + paper.scorePart3;
    paper.finishedAt = new Date();
    paper.status = "completed";
    await paper.save();

    res.json({
      ok: true,
      scores: {
        part1: paper.scorePart1,
        part2: paper.scorePart2,
        part3: paper.scorePart3,
        total: paper.totalScore,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* -------- Eski sınavlar listesi -------- */
router.get("/history", async (req, res) => {
  try {
    const studentId = req.user.id;
    const papers = await ExamPaper.find({ studentId, status: "completed" })
      .populate("examId")
      .sort({ finishedAt: -1 })
      .lean();

    const list = papers.map((p) => ({
      id: p._id,
      examTitle: p.examId?.title,
      date: p.finishedAt,
      totalScore: p.totalScore,
    }));

    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
