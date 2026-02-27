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

// ── Fetch Wandbox compiler list at startup and pick best match ────────────
// Maps our frontend language key → search keywords to find the right compiler
const LANG_SEARCH = {
  "nodejs-20.17.0":    { lang: "JavaScript",  prefer: ["nodejs"] },
  "cpython-3.12.0":   { lang: "Python",       prefer: ["cpython"] },
  "gcc-13.2.0-c":     { lang: "C",            prefer: ["gcc-c", "gcc"] },   // C-specific
  "gcc-13.2.0":       { lang: "C++",          prefer: ["gcc"] },
  "openjdk-jdk-21+35":{ lang: "Java",         prefer: ["openjdk", "java"] },
  "rust-1.82.0":      { lang: "Rust",         prefer: ["rust"] },
};

let COMPILER_MAP = {}; // will be populated at startup

async function buildCompilerMap() {
  try {
    const res = await fetch("https://wandbox.org/api/list.json");
    const list = await res.json(); // array of compiler objects

    for (const [frontendKey, { lang, prefer }] of Object.entries(LANG_SEARCH)) {
      // Filter compilers matching this language
      const candidates = list.filter(c =>
        c.language && c.language.toLowerCase() === lang.toLowerCase()
      );

      if (candidates.length === 0) {
        console.warn(`No Wandbox compiler found for language: ${lang}`);
        continue;
      }

      // Try each preferred keyword in order; pick first match
      let chosen = null;
      for (const kw of prefer) {
        chosen = candidates.find(c => c.name && c.name.toLowerCase().includes(kw));
        if (chosen) break;
      }

      // Fallback: just use the first candidate
      if (!chosen) chosen = candidates[0];

      COMPILER_MAP[frontendKey] = chosen.name;
      console.log(`  ${frontendKey} → ${chosen.name}`);
    }

    console.log("Wandbox compiler map ready:", COMPILER_MAP);
  } catch (err) {
    console.error("Failed to fetch Wandbox compiler list, using hardcoded fallback:", err.message);

    // Hardcoded fallback — best known values as of early 2025
    COMPILER_MAP = {
      "nodejs-20.17.0":    "nodejs-head",
      "cpython-3.12.0":   "cpython-3.12.0",
      "gcc-13.2.0-c":     "gcc-head-c",
      "gcc-13.2.0":       "gcc-head",
      "openjdk-jdk-21+35":"openjdk-head",
      "rust-1.82.0":      "rust-head",
    };
  }
}

// ── Execute endpoint ──────────────────────────────────────────────────────
app.post("/execute", async (req, res) => {
  const { code, compiler: langKey } = req.body;
  const wandboxCompiler = COMPILER_MAP[langKey] || langKey;

  console.log(`Running [${langKey}] → wandbox compiler: [${wandboxCompiler}]`);

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler: wandboxCompiler, code }),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch {
      console.error("Wandbox non-JSON response:", text);
      res.status(400).json({ status: "1", program_error: text });
    }
  } catch (error) {
    console.error("Execution error:", error);
    res.status(500).json({ status: "1", program_error: "Backend execution failed" });
  }
});

// ── Debug endpoint: see the live compiler map ─────────────────────────────
app.get("/compilers", (req, res) => res.json(COMPILER_MAP));

// ── Socket.IO ─────────────────────────────────────────────────────────────
const userSocketMap = {};

const getAllConnectedClients = (roomId) =>
  Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, { clients, username, socketId: socket.id });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on("disconnecting", () => {
    [...socket.rooms].forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

// ── Start: fetch compiler map first, then listen ──────────────────────────
const PORT = process.env.PORT || 5000;

buildCompilerMap().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
