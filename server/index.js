const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");

app.use(cors({
  origin: "https://realtimecodecolab.onrender.com",
  methods: ["GET", "POST"]
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://realtimecodecolab.onrender.com",
    methods: ["GET", "POST"],
  },
});

// ── Compiler map ──────────────────────────────────────────────────────────
// Maps the frontend language key → valid Wandbox compiler ID.
// Using *-head aliases keeps this working even as Wandbox updates versions.
const COMPILER_MAP = {
  "nodejs-20.17.0":    "nodejs-head",
  "cpython-3.12.0":   "cpython-head",
  "gcc-13.2.0-c":     "gcc-head-c",
  "gcc-13.2.0":       "gcc-head",
  "openjdk-jdk-21+35":"openjdk-head",
  "rust-1.82.0":      "rust-head",
};

// ── Execute endpoint ──────────────────────────────────────────────────────
app.post("/execute", async (req, res) => {
  const { code, compiler: langKey } = req.body;

  // Translate the frontend key to a real Wandbox compiler ID
  const wandboxCompiler = COMPILER_MAP[langKey] || langKey;

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: wandboxCompiler,
        code: code,
      }),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch (err) {
      console.error("Wandbox returned non-JSON:", text);
      res.status(400).json({ status: "1", program_error: text });
    }
  } catch (error) {
    console.error("Execution error:", error);
    res.status(500).json({ status: "1", program_error: "Backend execution failed" });
  }
});

// ── Socket.IO ─────────────────────────────────────────────────────────────
const userSocketMap = {};

const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
};

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
