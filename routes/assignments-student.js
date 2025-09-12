const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const StudentAssignment = require("../models/StudentAssignment");
const Question = require("../models/Question");
const Block = require("../models/Block");
const Topic = require("../models/Topic");
const { gradeAnswer } = require("../utils/grade");

const fmt = (q) => String(q?.questionFormat || q?.type || "").toLowerCase();

function normalizeMulti3(m) {
  const norm = (arr) =>
    (Array.isArray(arr) ? Array.from(new Set(arr)) : [])
      .filter((x) => ["A", "B", "C", "D", "E"].includes(String(x).toUpperCase()))
      .map((x) => String(x).toUpperCase())
      .slice(0, 2)
      .sort();
  return { s1: norm(m?.s1), s2: norm(m?.s2), s3: norm(m?.s3) };
}

/* ----------- Öğrenci kutusu ----------- */
router.get("/box", async (req, res) => {
  try {
    const studentId = req.user.id;

    const rows = await StudentAssignment.find({ studentId })
      .populate({ path: "assignmentId", select: "title visibilityStartAt isPublished dueAt topicNames" })
      .sort({ createdAt: -1 })
      .lean();

    const lastPercentOf = (sa) => {
      if (Array.isArray(sa.finishes) && sa.finishes.length) {
        const snap = sa.finishes[sa.finishes.length - 1]?.snapshotPercent;
        if (typeof snap === "number") return Math.round(snap);
      }
      if (typeof sa.scorePercent === "number") return Math.round(sa.scorePercent);
      const total = Array.isArray(sa.items) ? sa.items.length : 0;
      const done  = Array.isArray(sa.items) ? sa.items.filter(x => x.status==="done").length : 0;
      return total > 0 ? Math.round((done/total)*100) : 0;
    };

    // konuları hesapla (gerekirse)
    const allQids = [];
    for (const sa of rows) for (const it of sa.items || []) if (it.questionId) allQids.push(String(it.questionId));
    const qDocs = allQids.length ? await Question.find({ _id: { $in: allQids } }, { _id: 1, blockId: 1 }).lean() : [];
    const qToBlock = new Map(qDocs.map(q => [String(q._id), String(q.blockId||"")]));
    const blockIds = [...new Set(qDocs.map(q => String(q.blockId)).filter(Boolean))];
    const bDocs = blockIds.length ? await Block.find({ _id: { $in: blockIds } }, { _id: 1, topicId: 1 }).lean() : [];
    const blockToTopic = new Map(bDocs.map(b => [String(b._id), String(b.topicId||"")]));
    const topicIds = [...new Set(bDocs.map(b => String(b.topicId)).filter(Boolean))];
    const tDocs = topicIds.length ? await Topic.find({ _id: { $in: topicIds } }, { _id: 1, name: 1, title: 1 }).lean() : [];
    const topicNameById = new Map(tDocs.map(t => [String(t._id), t.name || t.title || ""]));

    const items = rows.map((sa) => {
      let topics = Array.isArray(sa.assignmentId?.topicNames) ? [...new Set(sa.assignmentId.topicNames.map(String))] : [];
      if (topics.length === 0) {
        const tset = new Set();
        for (const it of sa.items || []) {
          const bid = qToBlock.get(String(it.questionId));
          const tid = bid ? blockToTopic.get(bid) : null;
          const name = tid ? topicNameById.get(tid) : null;
          if (name) tset.add(name);
        }
        topics = [...tset];
      }

      return {
        id: String(sa._id),
        status: sa.status || "assigned",
        lastPercent: lastPercentOf(sa),
        completedCount: sa.completedCount || 0,
        assignment: {
          title: sa.assignmentId?.title || "Ödev",
          questionCount: Array.isArray(sa.items) ? sa.items.length : 0,
          totalPoints: sa.totalPoints || 0,
          visibleAt: sa.assignmentId?.visibilityStartAt || null,
          dueAt: sa.assignmentId?.dueAt || null,
          topics: topics.slice(0, 8),
        },
      };
    });

    res.json({ ok: true, items });
  } catch (e) {
    console.error("student /box error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server hatası" });
  }
});

/* ----------- Ödevi tüm sorularla getir (blok sırası + orijinal sıra) ----------- */
router.get("/:id/full", async (req, res) => {
  try {
    const studentId = req.user.id;
    const saId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(saId)) {
      return res.status(400).json({ message: "Yanlış id" });
    }

    const sa = await StudentAssignment.findOne({ _id: saId, studentId })
      .populate({ path: "assignmentId", select: "title dueAt isPublished" })
      .lean();
    if (!sa) return res.status(404).json({ message: "Ödev bulunamadı" });

    const qids = (sa.items || []).map((it) => it.questionId).filter(Boolean);

    const qs = await Question.find(
      { _id: { $in: qids } },
      {
        _id: 1, imageUrl: 1,
        answerImage_A: 1, answerImage_B: 1, answerImage_C: 1, answerImage_D: 1, answerImage_E: 1,
        type: 1, questionFormat: 1, blockId: 1
      }
    ).lean();
    const qMap = new Map(qs.map((q) => [String(q._id), q]));

    const blockIds = [...new Set(qs.map((q) => String(q.blockId || "")).filter(Boolean))];
    const bDocs = blockIds.length ? await Block.find({ _id: { $in: blockIds } }, { _id: 1, blockNumber: 1 }).lean() : [];
    const blockNoById = new Map(bDocs.map(b => [String(b._id), (b.blockNumber ?? Number.POSITIVE_INFINITY)]));

    const groups = new Map();
    (sa.items || []).forEach((it, idx) => {
      const q = qMap.get(String(it.questionId));
      const bid = String(q?.blockId || "");
      const bn  = blockNoById.get(bid) ?? Number.POSITIVE_INFINITY;
      if (!groups.has(bid)) groups.set(bid, { bn, rows: [] });
      groups.get(bid).rows.push({ it, idx });
    });

    const ordered = Array.from(groups.entries())
      .sort((a, b) => a[1].bn - b[1].bn)
      .flatMap(([, g]) => g.rows.sort((x,y) => x.idx - y.idx).map(r => r.it));

    const items = ordered.map((it) => {
      const q = qMap.get(String(it.questionId)) || {};
      const options = {
        A: q.answerImage_A || null, B: q.answerImage_B || null, C: q.answerImage_C || null,
        D: q.answerImage_D || null, E: q.answerImage_E || null,
      };
      return {
        id: String(it.questionId),
        state: {
          status: it.status || "todo",
          answerOption: it.answerOption ?? undefined,
          answerMulti3: it.answerMulti3 || undefined,
          answerNumeric: it.answerNumeric ?? undefined,
          isCorrect: typeof it.isCorrect === "boolean" ? it.isCorrect : undefined,
        },
        question: {
          imageUrl: q.imageUrl || null,
          options,
          type: q.type || "test",
          questionFormat: q.questionFormat || undefined,
        },
        helper: null,
      };
    });

    res.json({ assignment: { title: sa.assignmentId?.title || "Ödev", dueAt: sa.assignmentId?.dueAt || null }, items });
  } catch (e) {
    console.error("student full error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server hatası" });
  }
});

/* ----------- Soru cevapla ----------- */
router.post("/:id/answer", async (req, res) => {
  try {
    const studentId = req.user.id;
    const assignmentId = req.params.id;
    const { questionId, answerOption, answerText, answerMulti3, answerNumeric } = req.body;

    if (!questionId) return res.status(400).json({ message: "Soru ID gerekli" });
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: "Yanlış id" });
    }

    const sa = await StudentAssignment.findOne({ _id: assignmentId, studentId }).populate("assignmentId");
    if (!sa) return res.status(404).json({ message: "Ödev bulunamadı" });

    const assignment = sa.assignmentId;
    if (!assignment || !assignment.isPublished) {
      return res.status(403).json({ message: "Bu ödev henüz yayında değil" });
    }

    const it = sa.items.find((i) => String(i.questionId) === String(questionId));
    if (!it) return res.status(404).json({ message: "Soru bulunamadı" });

    if (answerMulti3) {
      it.answerMulti3 = normalizeMulti3(answerMulti3);
      it.answerOption = undefined; it.answerText = undefined; it.answerNumeric = undefined;
    } else if (typeof answerNumeric !== "undefined" || typeof answerText !== "undefined") {
      const raw = String(answerText ?? answerNumeric ?? "").trim();
      const num = Number(String(answerNumeric ?? raw).replace(",", "."));
      if (Number.isFinite(num)) it.answerNumeric = num;
      it.answerText = raw;
      it.answerOption = undefined; it.answerMulti3 = undefined;
    } else {
      it.answerOption = answerOption;
      it.answerText = undefined; it.answerMulti3 = undefined; it.answerNumeric = undefined;
    }

    it.status = "done";
    it.attempts = (it.attempts || 0) + 1;
    it.answeredAt = new Date();

    // anında puanlayalım
    const qDoc = await Question.findById(questionId).lean();
    let payload;
    if (answerMulti3) payload = { answerMulti3: it.answerMulti3 };
    else if (fmt(qDoc) === "open") payload = { numeric: it.answerNumeric, text: it.answerText };
    else payload = { option: it.answerOption };

    const g = gradeAnswer(qDoc, payload);
    if (typeof g.isCorrect === "boolean") {
      it.isCorrect = g.isCorrect;
      const base = Number(it.points) || 1;
      it.pointsEarned = g.isCorrect ? base : 0;
    } else {
      it.isCorrect = null;
      it.pointsEarned = 0;
    }

    sa.completedCount = (sa.items || []).filter((x) => x.status === "done").length;

    await sa.save();
    res.json({ ok: true });
  } catch (e) {
    console.error("Answer question error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server hatası" });
  }
});

/* ----------- Ödevi bitir (snapshot ekler; ilk/son bozulmaz) ----------- */
router.post("/:id/finish", async (req, res) => {
  try {
    const studentId = req.user.id;
    const assignmentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: "Yanlış id" });
    }

    const sa = await StudentAssignment.findOne({ _id: assignmentId, studentId })
      .populate("assignmentId");
    if (!sa) return res.status(404).json({ message: "Ödev bulunamadı" });

    const assignment = sa.assignmentId;
    if (!assignment || !assignment.isPublished) {
      return res.status(403).json({ message: "Bu ödev henüz yayında değil" });
    }

    // Tüm soruları yeniden değerlendir
    const qids = (sa.items || []).map(it => it.questionId).filter(Boolean);
    const qDocs = qids.length ? await Question.find({ _id: { $in: qids } }).lean() : [];
    const qMap = new Map(qDocs.map(q => [String(q._id), q]));

    let sumPointsEarned = 0;
    const hasAnyAnswer = (it) =>
      it?.answerOption != null ||
      (it?.answerText && String(it.answerText).trim().length > 0) ||
      (typeof it?.answerNumeric === "number") ||
      (it?.answerMulti3 && ((it.answerMulti3.s1?.length||0) + (it.answerMulti3.s2?.length||0) + (it.answerMulti3.s3?.length||0) > 0));

    for (const it of (sa.items || [])) {
      const q = qMap.get(String(it.questionId));
      if (!q) continue;

      let payload;
      if (it.answerMulti3) payload = { answerMulti3: it.answerMulti3 };
      else if (fmt(q) === "open") payload = { numeric: it.answerNumeric, text: it.answerText };
      else payload = { option: it.answerOption };

      if (hasAnyAnswer(it)) it.status = "done";

      const g = gradeAnswer(q, payload);
      if (typeof g.isCorrect === "boolean") {
        it.isCorrect = g.isCorrect;
        const base = Number(it.points) || 1;
        it.pointsEarned = g.isCorrect ? base : 0;
      } else {
        it.isCorrect = null;
        it.pointsEarned = 0;
      }
      sumPointsEarned += Number(it.pointsEarned) || 0;
    }

    const total = Array.isArray(sa.items) ? sa.items.length : 0;
    const correctCount = total ? sa.items.filter(x => x.isCorrect === true).length : 0;
    const snapshotPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    sa.pointsEarned   = sumPointsEarned;
    sa.totalPoints    = sa.totalPoints || (sa.items || []).reduce((a, it) => a + (Number(it.points) || 0), 0);
    sa.completedCount = (sa.items || []).filter(x => x.status === "done").length;

    sa.finishes = sa.finishes || [];
    sa.finishes.push({ at: new Date(), snapshotPercent });

    sa.status       = "completed";
    sa.scorePercent = snapshotPercent;

    await sa.save();

    return res.json({
      ok: true,
      summary: {
        questionCount: total,
        completedCount: sa.completedCount || 0,
        scorePercent: snapshotPercent,
        redoCount: Math.max((sa.finishes.length || 1) - 1, 0),
      },
    });
  } catch (e) {
    console.error("finish error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server hatası" });
  }
});

module.exports = router;
