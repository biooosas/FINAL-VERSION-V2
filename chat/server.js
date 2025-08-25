/**
 * server.js
 * Express + Socket.io realtime chat server with minimal REST API for auth/upload/profile.
 *
 * Run:
 *   npm install
 *   npm start
 *
 * WARNING: demo-level server. For public deployment secure further (TLS, rate limits, input validation).
 */

import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
await fs.ensureDir(DATA_DIR);
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ROOMS_FILE = path.join(DATA_DIR, "rooms.json");
const DMS_FILE = path.join(DATA_DIR, "dms.json");
await fs.writeJSON(USERS_FILE, (await fs.pathExists(USERS_FILE)) ? await fs.readJSON(USERS_FILE) : {});
await fs.writeJSON(ROOMS_FILE, (await fs.pathExists(ROOMS_FILE)) ? await fs.readJSON(ROOMS_FILE) : {});
await fs.writeJSON(DMS_FILE, (await fs.pathExists(DMS_FILE)) ? await fs.readJSON(DMS_FILE) : {});

let USERS = await fs.readJSON(USERS_FILE); // { uid: {uid,email,passwordHash,displayName,avatarUrl,color,theme,token} }
let ROOMS = await fs.readJSON(ROOMS_FILE); // { id: {id,name,isPrivate,owner,members:[],messages:[] } }
let DMS = await fs.readJSON(DMS_FILE);     // { id: {id,participants:[],messages:[] } }

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// helpers
const persistAll = async () => {
  await fs.writeJSON(USERS_FILE, USERS, { spaces: 2 });
  await fs.writeJSON(ROOMS_FILE, ROOMS, { spaces: 2 });
  await fs.writeJSON(DMS_FILE, DMS, { spaces: 2 });
};

const publicProfile = (u) => ({
  uid: u.uid,
  email: u.email,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl || null,
  color: u.color || "#5865F2",
  theme: u.theme || "black-gray"
});

// simple upload endpoint (base64)
app.post("/api/upload", async (req, res) => {
  try {
    const { filename, dataBase64 } = req.body;
    if (!filename || !dataBase64) return res.status(400).json({ error: "missing" });
    const buf = Buffer.from(dataBase64.split(",").pop(), "base64");
    await fs.ensureDir(path.join(__dirname, "uploads"));
    const name = `${Date.now()}-${uuidv4()}-${filename.replace(/[^a-z0-9_.-]/gi, "")}`;
    const full = path.join(__dirname, "uploads", name);
    await fs.writeFile(full, buf);
    return res.json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// signup
app.post("/api/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email/password required" });
  if (Object.values(USERS).find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "email in use" });
  }
  const uid = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  const token = uuidv4();
  USERS[uid] = { uid, email, passwordHash: hash, displayName: displayName || email.split("@")[0], avatarUrl: null, color: "#5865F2", theme: "black-gray", token };
  await persistAll();
  return res.json({ ok: true, token, profile: publicProfile(USERS[uid]) });
});

// login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email/password required" });
  const user = Object.values(USERS).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(400).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "invalid credentials" });
  user.token = uuidv4();
  await persistAll();
  return res.json({ ok: true, token: user.token, profile: publicProfile(user) });
});

// restore by token
app.post("/api/restore", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });
  const user = Object.values(USERS).find(u => u.token === token);
  if (!user) return res.status(400).json({ error: "invalid token" });
  return res.json({ ok: true, profile: publicProfile(user) });
});

// profile update
app.post("/api/profile/update", async (req, res) => {
  const { token, displayName, avatarUrl, color, theme } = req.body;
  const user = Object.values(USERS).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: "invalid token" });
  if (displayName) user.displayName = displayName;
  if (typeof avatarUrl !== "undefined") user.avatarUrl = avatarUrl;
  if (color) user.color = color;
  if (theme) user.theme = theme;
  await persistAll();
  io.emit("profile:update", publicProfile(user));
  res.json({ ok: true, profile: publicProfile(user) });
});

// create room
app.post("/api/rooms/create", async (req, res) => {
  const { token, name, isPrivate } = req.body;
  const user = Object.values(USERS).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: "invalid token" });
  const id = uuidv4();
  ROOMS[id] = { id, name, isPrivate: !!isPrivate, owner: user.uid, members: !!isPrivate ? [user.uid] : [], messages: [] };
  await persistAll();
  io.emit("rooms:update", Object.values(ROOMS));
  res.json({ ok: true, room: ROOMS[id] });
});

// invite to private room
app.post("/api/rooms/invite", async (req, res) => {
  const { token, roomId, email } = req.body;
  const user = Object.values(USERS).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: "invalid token" });
  const room = ROOMS[roomId];
  if (!room) return res.status(404).json({ error: "room not found" });
  if (room.owner !== user.uid && !room.members.includes(user.uid)) return res.status(403).json({ error: "not allowed" });
  const target = Object.values(USERS).find(u => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!target) return res.status(404).json({ error: "user not found" });
  if (!room.members.includes(target.uid)) room.members.push(target.uid);
  await persistAll();
  io.emit("rooms:update", Object.values(ROOMS));
  res.json({ ok: true });
});

// open or create DM
app.post("/api/dms/open", async (req, res) => {
  const { token, otherEmail } = req.body;
  const me = Object.values(USERS).find(u => u.token === token);
  if (!me) return res.status(401).json({ error: "invalid token" });
  const other = Object.values(USERS).find(u => u.email.toLowerCase() === (otherEmail || "").toLowerCase());
  if (!other) return res.status(404).json({ error: "user not found" });
  const id = [me.uid, other.uid].sort().join("_");
  if (!DMS[id]) DMS[id] = { id, participants: [me.uid, other.uid], messages: [] };
  await persistAll();
  return res.json({ ok: true, thread: DMS[id] });
});

// state fetch
app.post("/api/state", async (req, res) => {
  const { token } = req.body;
  const user = Object.values(USERS).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: "invalid token" });
  res.json({
    ok: true,
    profile: publicProfile(user),
    rooms: Object.values(ROOMS),
    dms: Object.values(DMS),
    users: Object.values(USERS).map(publicProfile)
  });
});

// Socket.io realtime
io.on("connection", (socket) => {
  socket.on("auth", (token) => {
    const user = Object.values(USERS).find(u => u.token === token);
    if (!user) {
      socket.emit("auth:fail");
      return;
    }
    socket.user = user;
    socket.emit("auth:ok", { profile: publicProfile(user) });
    socket.emit("state", { rooms: Object.values(ROOMS), dms: Object.values(DMS) });
    io.emit("presence", Object.values(USERS).map(publicProfile));
  });

  socket.on("sendMessage", async (msg) => {
    // msg: { token, channelType:'room'|'dm', channelId, text, imageUrl }
    const user = Object.values(USERS).find(u => u.token === msg.token);
    if (!user) return;
    const payload = {
      id: uuidv4(),
      uid: user.uid,
      displayName: user.displayName,
      text: msg.text || null,
      imageUrl: msg.imageUrl || null,
      createdAt: Date.now()
    };
    if (msg.channelType === "room") {
      const room = ROOMS[msg.channelId];
      if (!room) return;
      if (room.isPrivate && !room.members.includes(user.uid) && room.owner !== user.uid) return;
      room.messages.push(payload);
      await persistAll();
      io.emit("message", { channelType: "room", channelId: room.id, message: payload });
    } else if (msg.channelType === "dm") {
      const thread = DMS[msg.channelId];
      if (!thread) return;
      if (!thread.participants.includes(user.uid)) return;
      thread.messages.push(payload);
      await persistAll();
      io.emit("message", { channelType: "dm", channelId: thread.id, message: payload });
    }
  });

  socket.on("updateProfile", async (p) => {
    const user = Object.values(USERS).find(u => u.token === p.token);
    if (!user) return;
    if (p.displayName) user.displayName = p.displayName;
    if (typeof p.avatarUrl !== "undefined") user.avatarUrl = p.avatarUrl;
    if (p.color) user.color = p.color;
    if (p.theme) user.theme = p.theme;
    await persistAll();
    io.emit("profile:update", publicProfile(user));
  });

  socket.on("disconnect", () => {
    io.emit("presence", Object.values(USERS).map(publicProfile));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
