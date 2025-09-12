const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Assignment = require("../models/Assignment");
const Question = require("../models/Question");
const StudentAssignment = require("../models/StudentAssignment");
const User = require("../models/User");
const Block = require("../models/Block");
const Topic = require("../models/Topic");
const { todayKeyBaku, atBaku } = require("../utils/dateKeyBaku");

/* ---------------- helpers ---------------- */
const toNum = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
function sumPoints(items = []) {
  return items.reduce((acc, it) => acc + (Number(it.points) || 0), 0);
}
function buildStudentItems(assignmentItems = []) {
  return assignmentItems.map((it) => ({
    questionId: it.questionId,
    status: "todo",
    answerOption: undefined,
    answerText: undefined,
    isCorrect: false,
    answeredAt: undefined,
    attempts: 0,
    points: Number(it.points) || 1,
    pointsEarned: 0,
  }));
}
async function fanOutToStudents(assignmentDoc) {
  const groups = assignmentDoc.groupNames || [];
  if (!groups.length) return { students: 0, inserted: 0 };

  const students = await User.find(
    { role: "user", group: { $in: groups } },
    { _id: 1 }
  ).lean();
  if (!students.length) return { students: 0, inserted: 0 };

  const totalPoints = sumPoints(assignmentDoc.items || []);
  const studentItems = buildStudentItems(assignmentDoc.items || []);

  const rows = students.map((s) => ({
    assignmentId: assignmentDoc._id,
    studentId: s._id,
    items: studentItems,
    totalPoints,
    pointsEarned: 0,
    scorePercent: 0,
    completedCount: 0,
  }));

  let inserted = 0;
  try {
    const res = await StudentAssignment.insertMany(rows, { ordered: false });
    inserted = Array.isArray(res) ? res.length : 0;
  } catch (e) {
    if (e?.code !== 11000) console.error("fanOutToStudents error:", e);
  }
  return { students: students.length, inserted };
}

/* ---------------- CREATE (manuel ids) ---------------- */
router.post("/", async (req, res) => {
  try {
    const {
      groupNames = [],
      questionIds = [],
      title,
      instructions,
      visibleHour = 6,
      dueAt,
      pointsPerQuestion = 1,
      publishNow = false,
    } = req.body;

    if (!Array.isArray(groupNames) || !groupNames.length)
      return res.status(400).json({ message: "groupNames boş olamaz" });
    if (!Array.isArray(questionIds) || !questionIds.length)
      return res.status(400).json({ message: "questionIds boş olamaz" });

    const ids = questionIds.map((id) => new mongoose.Types.ObjectId(id));
    const count = await Question.countDocuments({ _id: { $in: ids } });
    if (count !== questionIds.length)
      return res.status(400).json({ message: "Bazı questionIds geçersiz" });

    const items = ids.map((qid) => ({
      questionId: qid,
      points: Number(pointsPerQuestion) || 1,
    }));

    const dateKey = todayKeyBaku();
    const visibilityStartAt = publishNow ? new Date() : atBaku(Number(visibleHour) || 6, 0);

    let dueDate = dueAt ? new Date(dueAt) : null;
    if (!dueDate || isNaN(dueDate.getTime())) {
      const base = new Date(`${dateKey}T00:00:00`);
      dueDate = new Date(base.getTime() + (23 * 60 + 59) * 60 * 1000);
    }

    const doc = await Assignment.create({
      dateKey,
      title: title || "Günlük Ödev",
      instructions: instructions || "",
      groupNames,
      items,
      visibilityStartAt,
      dueAt: dueDate,
      createdBy: req.user.id,
      isPublished: !!publishNow,
    });

    const fanout = await fanOutToStudents(doc);
    res.json({ ok: true, assignment: doc, fanout });
  } catch (e) {
    console.error("Assignment create error:", e);
    res.status(500).json({ ok: false, message: e.message || "Hata" });
  }
});

/* ---------------- CREATE by topics ---------------- */
router.post("/create-by-topics", async (req, res) => {
  try {
    const {
      groupNames = [],
      topicIds = [],
      title,
      instructions,
      visibleHour = 6,
      dueAt,
      pointsPerQuestion = 1,
      publishNow = false,
    } = req.body;

    if (!Array.isArray(groupNames) || !groupNames.length)
      return res.status(400).json({ message: "groupNames boş olamaz" });
    if (!Array.isArray(topicIds) || !topicIds.length)
      return res.status(400).json({ message: "topicIds boş olamaz" });

    const blocks = await Block.find({ topicId: { $in: topicIds } }, { _id: 1 }).lean();
    const blockIds = blocks.map((b) => b._id);
    if (!blockIds.length)
      return res.status(400).json({ message: "Seçilen konularda blok yok" });

    const hwQs = await Question.find(
      { blockId: { $in: blockIds }, $or: [{ type: "homework" }, { group: "ev ödevi" }] },
      { _id: 1 }
    ).lean();
    if (!hwQs.length)
      return res.status(400).json({ message: "Bu konularda ödev sorusu yok" });

    const questionIds = [...new Set(hwQs.map((q) => String(q._id)))];
    const items = questionIds.map((id) => ({
      questionId: new mongoose.Types.ObjectId(id),
      points: Number(pointsPerQuestion) || 1,
    }));

    const dateKey = todayKeyBaku();
    const visibilityStartAt = publishNow ? new Date() : atBaku(Number(visibleHour) || 6, 0);

    let dueDate = dueAt ? new Date(dueAt) : null;
    if (!dueDate || isNaN(dueDate.getTime())) {
      const base = new Date(`${dateKey}T00:00:00`);
      dueDate = new Date(base.getTime() + (23 * 60 + 59) * 60 * 1000);
    }

    const doc = await Assignment.create({
      dateKey,
      title: title || "Günlük Ödev",
      instructions: instructions || "",
      groupNames,
      items,
      visibilityStartAt,
      dueAt: dueDate,
      createdBy: req.user.id,
      isPublished: !!publishNow,
    });

    const fanout = await fanOutToStudents(doc);
    res.json({
      ok: true,
      assignment: doc,
      counts: { blocks: blockIds.length, questions: items.length },
      fanout,
    });
  } catch (e) {
    console.error("create-by-topics error:", e);
    res.status(500).json({ ok: false, message: e.message || "Hata" });
  }
});

/* ---------------- publish / unpublish ---------------- */
router.post("/:id/publish", async (req, res) => {
  try {
    const assn = await Assignment.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: true, visibilityStartAt: new Date() } },
      { new: true }
    );
    if (!assn) return res.status(404).json({ message: "Assignment bulunamadı" });

    const fanout = await fanOutToStudents(assn);
    res.json({ ok: true, assignment: assn, fanout });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/:id/unpublish", async (req, res) => {
  try {
    const assn = await Assignment.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: false } },
      { new: true }
    );
    if (!assn) return res.status(404).json({ message: "Assignment bulunamadı" });
    res.json({ ok: true, assignment: assn });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------------- list (withSummary) ---------------- */
router.get("/", async (req, res) => {
  try {
    const { date, withSummary } = req.query;
    const filter = {};
    if (typeof date === "string" && date.length === 10) filter.dateKey = date;

    const raw = await Assignment.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "items.questionId", select: "blockId" })
      .lean();

    const baseList = (raw || []).map(a => ({
      _id: String(a._id),
      dateKey: a.dateKey,
      createdAt: a.createdAt,
      title: a.title || "Ödev",
      isPublished: !!a.isPublished,
      groupNames: a.groupNames || [],
      questionCount: (a.items || []).length,
      topicNames: [],
      dueAt: a.dueAt,
    }));

    if (String(withSummary) !== "1") {
      return res.json({ ok: true, list: baseList });
    }

    try {
      const allBlockIds = new Set();
      for (const a of raw) {
        for (const it of (a.items || [])) {
          const q = it.questionId;
          if (q?.blockId) allBlockIds.add(String(q.blockId));
        }
      }

      const blockArr = await Block.find(
        { _id: { $in: Array.from(allBlockIds).map(id => new mongoose.Types.ObjectId(id)) } },
        { _id: 1, topicId: 1 }
      ).lean();
      const blockToTopic = new Map(blockArr.map(b => [String(b._id), String(b.topicId)]));

      const topicIds = Array.from(new Set(blockArr.map(b => String(b.topicId)).filter(Boolean)));
      const topicArr = await Topic.find(
        { _id: { $in: topicIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { _id: 1, name: 1 }
      ).lean();
      const topicNameById = new Map(topicArr.map(t => [String(t._id), t.name]));

      const out = raw.map(a => {
        const tset = new Set();
        for (const it of (a.items || [])) {
          const q = it.questionId;
          if (!q?.blockId) continue;
          const tid = blockToTopic.get(String(q.blockId));
          const name = tid ? topicNameById.get(tid) : null;
          if (name) tset.add(name);
        }
        return {
          _id: String(a._id),
          dateKey: a.dateKey,
          createdAt: a.createdAt,
          title: a.title || "Ödev",
          isPublished: !!a.isPublished,
          groupNames: a.groupNames || [],
          questionCount: (a.items || []).length,
          topicNames: Array.from(tset),
          dueAt: a.dueAt,
        };
      });

      return res.json({ ok: true, list: out });
    } catch (sumErr) {
      console.error("assignments list summary error:", sumErr);
      return res.json({ ok: true, list: baseList });
    }
  } catch (e) {
    console.error("assignments list error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------------- DETAIL ---------------- */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Assignment.findById(req.params.id)
      .populate({
        path: "items.questionId",
        select: `
          imageUrl
          answerImageUrl answerImage_A answerImage_B answerImage_C answerImage_D answerImage_E
          difficulty category topic blockNumber blockId
          questionFormat type
          correctAnswer numericAnswer correctMulti
        `,
      })
      .lean();
    if (!doc) return res.status(404).json({ message: "Assignment bulunamadı" });
    res.json({ ok: true, assignment: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------------- STATS ---------------- */
router.get("/:id/stats", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Yanlış id" });

    const assn = await Assignment.findById(id).lean();
    if (!assn) return res.status(404).json({ message: "Assignment bulunamadı" });

    const allStudents = await User.find(
      { role: "user", group: { $in: assn.groupNames || [] } },
      { firstName: 1, lastName: 1, group: 1 }
    ).lean();
    const toFull = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim();
    const allMap = new Map(
      allStudents.map(u => [String(u._id), { _id: String(u._id), fullName: toFull(u), group: u.group || "-" }])
    );

    const sas = await StudentAssignment.find(
      { assignmentId: id },
      { studentId: 1, items: 1, pointsEarned: 1, totalPoints: 1, scorePercent: 1, finishes: 1 }
    ).lean();

    const totals = {
      totalStudents: allStudents.length,
      avgScorePercent: 0,
      avgPoints: 0,
      sumPointsEarned: 0,
      sumTotalPoints: 0,
      perQuestion: {}
    };

    const groupAgg = new Map();
    const ensureG = (g) => { if (!groupAgg.has(g)) groupAgg.set(g, { sum: 0, cnt: 0 }); return groupAgg.get(g); };

    const perQ = new Map();
    const hasAnyAnswer = (it) =>
      (it?.answerOption !== undefined && it?.answerOption !== null) ||
      (it?.answerText && String(it.answerText).trim().length > 0) ||
      (it?.answerMulti3 && (it.answerMulti3.s1?.length || it.answerMulti3.s2?.length || it.answerMulti3.s3?.length));

    const perfByStudent = new Map();

    for (const sa of sas) {
      const sid = String(sa.studentId);
      const info = allMap.get(sid);

      let firstPercent = null;
      let lastPercent = null;
      let redoCount = 0;

      if (Array.isArray(sa.finishes) && sa.finishes.length > 0) {
        const fp = sa.finishes[0]?.snapshotPercent;
        const lp = sa.finishes[sa.finishes.length - 1]?.snapshotPercent ?? fp;
        const fpn = toNum(fp);
        const lpn = toNum(lp);
        firstPercent = fpn != null ? Math.round(fpn) : null;
        lastPercent  = lpn != null ? Math.round(lpn) : null;
        redoCount = Math.max(sa.finishes.length - 1, 0);
      }

      if (lastPercent == null) {
        if (typeof sa.scorePercent === "number") lastPercent = Math.round(sa.scorePercent);
        else if (sa.totalPoints > 0) {
          const p = (Number(sa.pointsEarned || 0) / Number(sa.totalPoints || 1)) * 100;
          lastPercent = Math.round(p);
        }
      }
      if (firstPercent == null) firstPercent = lastPercent;

      perfByStudent.set(sid, { redoCount, firstPercent, lastPercent });

      if (info) {
        const p = lastPercent != null
          ? lastPercent
          : (typeof sa.scorePercent === "number"
            ? sa.scorePercent
            : (sa.totalPoints > 0 ? (sa.pointsEarned / sa.totalPoints) * 100 : 0));
        const g = ensureG(info.group);
        g.sum += Number(p) || 0;
        g.cnt += 1;
      }

      for (const it of (sa.items || [])) {
        const qid = String(it.questionId);
        if (!perQ.has(qid)) perQ.set(qid, { done: 0, correct: 0, wrong: 0, blank: 0, wrongIds: [], blankIds: [] });

        if (it.status !== "done") {
          perQ.get(qid).blank += 1;
          perQ.get(qid).blankIds.push(sid);
          continue;
        }
        perQ.get(qid).done += 1;

        if (!hasAnyAnswer(it)) {
          perQ.get(qid).blank += 1;
          perQ.get(qid).blankIds.push(sid);
          continue;
        }

        if (it.isCorrect) perQ.get(qid).correct += 1;
        else {
          perQ.get(qid).wrong += 1;
          perQ.get(qid).wrongIds.push(sid);
        }
      }

      totals.sumPointsEarned += Number(sa.pointsEarned) || 0;
      totals.sumTotalPoints  += Number(sa.totalPoints) || 0;
    }

    if (sas.length > 0) {
      totals.avgPoints = totals.sumTotalPoints > 0 ? totals.sumPointsEarned / sas.length : 0;
      const lastPercents = Array.from(perfByStudent.values())
        .map(v => (typeof v.lastPercent === "number" ? v.lastPercent : null))
        .filter(v => v != null);
      totals.avgScorePercent = lastPercents.length > 0
        ? Math.round(lastPercents.reduce((a,b)=>a+b,0) / lastPercents.length)
        : 0;
    }

    const perQuestionOut = {};
    for (const [qid, row] of perQ.entries()) {
      const wrongUsers = row.wrongIds.map(id => allMap.get(id)).filter(Boolean);
      const blankUsers = row.blankIds.map(id => allMap.get(id)).filter(Boolean);
      perQuestionOut[qid] = { done: row.done, correct: row.correct, wrong: row.wrong, blank: row.blank, wrongUsers, blankUsers };
    }
    totals.perQuestion = perQuestionOut;

    const groupAverages = Array.from(groupAgg.entries()).map(([groupName, v]) => ({
      groupName,
      submittedCount: v.cnt,
      avgScorePercent: v.cnt > 0 ? Math.round((v.sum / v.cnt) * 100) / 100 : 0
    })).sort((a,b)=>a.groupName.localeCompare(b.groupName));

    const studentsPerf = Array.from(allMap.values()).map(info => {
      const p = perfByStudent.get(info._id) || { redoCount: 0, firstPercent: null, lastPercent: null };
      return { _id: info._id, fullName: info.fullName, group: info.group, ...p };
    }).sort((a,b)=>a.fullName.localeCompare(b.fullName));

    return res.json({ ok: true, stats: totals, groupAverages, studentsPerf });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------------- DELETE ---------------- */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Yanlış id" });

    const del = await Assignment.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ message: "Assignment bulunamadı" });

    const saRes = await StudentAssignment.deleteMany({ assignmentId: id });
    res.json({ ok: true, deletedAssignmentId: id, removedStudentAssignments: saRes.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* --------- DEBUG: SA id -> Assignment id --------- */
router.get("/resolve-from-sa/:saId", async (req, res) => {
  try {
    const saId = req.params.saId;
    if (!mongoose.Types.ObjectId.isValid(saId)) {
      return res.status(400).json({ message: "Yanlış SA id" });
    }
    const sa = await StudentAssignment.findById(saId, { assignmentId: 1 }).lean();
    if (!sa) return res.status(404).json({ message: "SA bulunamadı" });
    res.json({ ok: true, assignmentId: String(sa.assignmentId) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* --------- DEBUG: bir ödevdeki soruların anahtar durumu --------- */
router.get("/:id/keys-check", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Yanlış id" });

    const assn = await Assignment.findById(id).lean();
    if (!assn) return res.status(404).json({ message: "Assignment yok" });

    const qids = (assn.items || []).map((it) => it.questionId).filter(Boolean);
    const qs = await Question.find(
      { _id: { $in: qids } },
      { _id: 1, questionFormat: 1, type: 1, correctAnswer: 1, numericAnswer: 1, correctMulti: 1 }
    ).lean();

    const out = qs.map((q) => {
      const fmt = String(q.questionFormat || q.type || "").toLowerCase();
      const hasTest = !!q.correctAnswer;
      const hasNum = q.numericAnswer !== undefined && q.numericAnswer !== null && String(q.numericAnswer) !== "";
      const cm = q.correctMulti || {};
      const hasM3 = !!((cm.s1?.length || 0) + (cm.s2?.length || 0) + (cm.s3?.length || 0));
      return {
        id: String(q._id),
        format: fmt || "unknown",
        hasKey: hasTest || hasNum || hasM3,
        keyPreview: hasTest ? q.correctAnswer : hasNum ? q.numericAnswer : hasM3 ? q.correctMulti : null,
      };
    });

    res.json({ ok: true, list: out });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
