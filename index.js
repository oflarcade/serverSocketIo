const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Replace with your frontend domain in production
    methods: ["GET", "POST"],
  },
});

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// Track sessions: { [sessionId]: { idle: Socket, controller: Socket } }
const sessions = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Handle session join
  socket.on("join", ({ sessionId, role }) => {
    if (!sessionId || !role) {
      console.warn("❌ Missing sessionId or role in join");
      return;
    }

    // Store metadata on the socket
    socket.sessionId = sessionId;
    socket.role = role;

    // Create or get session entry
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { idle: null, controller: null });
    }

    const session = sessions.get(sessionId);
    session[role] = socket;

    console.log(`✅ Socket ${socket.id} joined session ${sessionId} as ${role}`);

    // Notify both parties if connected
    if (session.idle && session.controller) {
      session.idle.emit("ready");
      session.controller.emit("ready");
    }
  });

  // Handle message routing
  socket.on("message", (data) => {
    const session = sessions.get(socket.sessionId);
    if (!session) {
      console.warn("❌ No session found for", socket.sessionId);
      return;
    }

    const target =
      socket.role === "controller" ? session.idle : session.controller;

    if (target) {
      target.emit("message", data);
      console.log(`📨 Message from ${socket.role} relayed to other device.`);
    } else {
      console.warn("⚠️ No target to send message to in session", socket.sessionId);
    }
  });

  // Handle disconnects
  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected`);

    const session = sessions.get(socket.sessionId);
    if (!session) return;

    if (session[socket.role] === socket) {
      session[socket.role] = null;

      const other =
        socket.role === "controller" ? session.idle : session.controller;

      if (other) {
        other.emit("peer-disconnected");
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
