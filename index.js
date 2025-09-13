// backend/index.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const User = require("./models/User");

// Routers
const assignmentsStudentRouter = require("./routes/assignments-student");
const assignmentsAdminRouter = require("./routes/assignments-admin");
const usersRouter = require("./routes/users");
const sectionsRouter = require("./routes/sections");
const topicsRouter = require("./routes/topics");
const blocksRouter = require("./routes/blocks");
const questionsRouter = require("./routes/questions");
const statusRouter = require("./routes/status"); // ✅

/* -------------------------- APP -------------------------- */
const app = express();

/* -------------------- CORS / ortak ayarlar -------------------- */
const CLIENT_ORIGIN =
  (process.env.CLIENT_ORIGIN &&
    process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())) ||
  ["http://localhost:5173"];

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

/* ------------------------- JWT yardımcıları ------------------------ */
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      group: user.group,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

/* ----------------------- Cookie parametreleri ---------------------- */
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge:
    typeof REFRESH_EXPIRES_IN === "string" && REFRESH_EXPIRES_IN.endsWith("d")
      ? parseInt(REFRESH_EXPIRES_IN) * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000,
};

/* ------------------------- Auth middleware ------------------------ */
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token təqdim edilməyib" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, id: decoded.sub };
    next();
  } catch {
    return res.status(401).json({ message: "Token etibarsız və ya vaxtı keçib" });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ message: "Yalnız admin icazəlidir" });
  next();
};

/* ------------------ DB bağlantısı + admin seed ------------------ */
async function createAdmin() {
  try {
    const exists = await User.findOne({ username: "admin" });
    if (exists) {
      console.log("ℹ️ Admin artıq mövcuddur");
      return;
    }
    const hashed = await bcrypt.hash("admin123", 10);
    const admin = new User({
      firstName: "Admin",
      lastName: "User",
      username: "admin",
      password: hashed,
      group: "-",
      role: "admin",
    });
    await admin.save();
    console.log("✅ Admin yaradıldı: admin / admin123");
  } catch (err) {
    console.error("Admin yaratma hatası:", err);
  }
}

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("✅ MongoDB bağlantısı uğurla quruldu");
    await createAdmin();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Backend çalışır: http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB bağlantı xətası:", err.message));

/* ----------------------------- Auth ------------------------------ */
app.post("/api/register", async (req, res) => {
  const { firstName, lastName, username, password, group } = req.body;
  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: "Bu istifadəçi adı artıq mövcuddur" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({
      firstName,
      lastName,
      username,
      password: hashed,
      group,
      role: "user",
    });
    await newUser.save();
    res.json({ message: "Qeydiyyat uğurla tamamlandı" });
  } catch {
    res.status(500).json({ message: "Server xətası" });
  }
});

app.post("/api/admin-register", async (req, res) => {
  const { firstName, lastName, username, password } = req.body;
  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: "Bu istifadəçi adı mövcuddur" });

    const hashed = await bcrypt.hash(password, 10);
    const newAdmin = new User({
      firstName,
      lastName,
      username,
      password: hashed,
      group: "-",
      role: "admin",
    });
    await newAdmin.save();
    res.json({ message: "Admin qeydiyyatı uğurla tamamlandı" });
  } catch {
    res.status(500).json({ message: "Xəta baş verdi" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "İstifadəçi tapılmadı" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Şifrə yanlışdır" });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie("refreshToken", refreshToken, cookieOpts);
    return res.json({
      token: accessToken,
      role: user.role,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        group: user.group,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Login hatası:", e);
    return res.status(500).json({ message: "Sunucu xətası" });
  }
});

/* --------------------------- Refresh ------------------------------ */
async function refreshHandler(req, res) {
  try {
    const { refreshToken } = req.cookies || {};
    if (!refreshToken) return res.status(401).json({ message: "Refresh token yoxdur" });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Refresh token etibarsız və ya vaxtı keçib" });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "İstifadəçi tapılmadı" });

    const newAccess = signAccessToken(user);
    const newRefresh = signRefreshToken(user);
    res.cookie("refreshToken", newRefresh, cookieOpts);
    return res.json({ token: newAccess });
  } catch {
    return res.status(500).json({ message: "Server xətası" });
  }
}
app.post("/api/auth/refresh", refreshHandler);
app.post("/api/refresh-token", refreshHandler);

app.post("/api/logout", (_req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  return res.json({ message: "Çıxış edildi" });
});

/* ----------------------- Korumalı endpointler --------------------- */
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ user: req.user });
});

/* ----------------------- ROUTER’ları mount et --------------------- */
/* DİKKAT: Sıra önemli — auth middleware'den sonra mount et. */

// Admin-only
app.use("/api/users", authenticate, isAdmin, usersRouter);
app.use("/api/sections", authenticate, isAdmin, sectionsRouter);
app.use("/api/topics", authenticate, isAdmin, topicsRouter);
app.use("/api/blocks", authenticate, isAdmin, blocksRouter);
app.use("/api/questions", authenticate, isAdmin, questionsRouter);
app.use("/api/assignments-admin", authenticate, isAdmin, assignmentsAdminRouter);

// Öğrenci / öğretmen erişimi
app.use("/api/assignments-student", authenticate, assignmentsStudentRouter);
app.use("/api/status", authenticate, statusRouter); // ✅ /me ve diğerleri için auth şart

/* --------------------- 404 & error handler ------------------------ */
app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

