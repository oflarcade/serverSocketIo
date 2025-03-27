const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For development. Lock this down later.
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});



const sessions = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join", ({ sessionId, role }) => {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { idle: null, controller: null });
    }

    const session = sessions.get(sessionId);
    session[role] = socket;

    console.log(`Socket ${socket.id} joined session ${sessionId} as ${role}`);

    // Notify both clients if ready
    if (session.idle && session.controller) {
      session.idle.emit("ready");
      session.controller.emit("ready");
    }

    socket.on("message", (data) => {
      const target = role === "controller" ? session.idle : session.controller;
      if (target) target.emit("message", data);
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
      if (session[role] === socket) {
        session[role] = null;
        const other = role === "controller" ? session.idle : session.controller;
        if (other) other.emit("peer-disconnected");
      }
    });
  });
});

const PORT = process.env.PORT || 3000; // Use env port on Railway

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});