const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");

// Enable CORS for standard Express HTTP requests
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

// --- Proxy Code Execution using Wandbox API ---
app.post("/execute", async (req, res) => {
  const { code, compiler } = req.body;
  
  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Uses the dynamic compiler passed from the frontend, defaults to Node 20
        compiler: compiler || "nodejs-20.17.0", 
        code: code,
      }),
    });
    
    // Safely parse the response in case Wandbox returns a plain text error instead of JSON
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch (err) {
      console.error("Wandbox returned non-JSON:", text);
      // Return a structured JSON error to the frontend if parsing fails
      res.status(400).json({ status: "1", program_error: text });
    }
  } catch (error) {
    console.error("Execution error:", error);
    res.status(500).json({ status: "1", program_error: "Backend execution failed" });
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