const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");

// Enabled CORS for standard Express HTTP requests
app.use(cors({
  origin: "https://realtimecodecolab.onrender.com",
  methods: ["GET", "POST"]
}));

// Middleware to parse incoming JSON payloads
app.use(express.json());

const server = http.createServer(app);

// Configure Socket.io with CORS allowing your frontend origin
const io = new Server(server, {
  cors: {
    origin: "https://realtimecodecolab.onrender.com", 
    methods: ["GET", "POST"],
  },
});

// --- NEW ROUTE: Proxy Code Execution ---
app.post("/execute", async (req, res) => {
  const { code } = req.body;
  
  try {
    // Makeing the request to Piston from the backend to bypass browser restrictions
    // Using version "*" tells Piston to automatically use the latest available Node.js version
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "javascript",
        version: "*", 
        files: [{ content: code }],
      }),
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Execution error:", error);
    res.status(500).json({ message: "Backend execution failed" });
  }
});

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
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