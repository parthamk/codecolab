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

// Execute endpoint — compiler keys are sent directly from frontend and must
// exactly match Wandbox's compiler names from /api/list.json
app.post("/execute", async (req, res) => {
  const { code, compiler } = req.body;

  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler, code }),
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

// Socket.IO
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
