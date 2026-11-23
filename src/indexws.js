require("dotenv").config();
const cors = require("cors");
const express = require("express");
const http = require("http");
const {
  startMarketData,
  stopMarketData,
  status,
  subscribe,
  unsubscribe,
} = require("./controllers/marketController");
const {
  getHistorical,
  getHistoricalForServer,
} = require("./controllers/historicalController");
const { getOI } = require("./controllers/oiController");
// NEW
const { wss } = require("../src/websocket/wsBroadcaster");
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:3123",
  "http://127.0.0.1:3223",
  "http://10.220.61.6:3123",
  "http://localhost:3123",
  "http://localhost:3001"
];
app.use(cors({
  origin: true, // Allows any origin while reflecting the origin header
  credentials: true
}));
/*
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));*/
/*app.use(cors({
  origin: "http://localhost:3123","http://127.0.0.1:3223",
  credentials: true
}));*/
app.use(express.json());
app.post("/start", startMarketData);
app.post("/stop", stopMarketData);
app.post("/subscribe", subscribe);
app.post("/oiupdate", getOI);
app.post("/unsubscribe", unsubscribe);
app.post("/historical", getHistorical);
app.post("/historicalForServer", getHistoricalForServer);
app.get("/status", status);
// -----------------------------
// WebSocket endpoint
// ws://localhost:3001/feed
// -----------------------------
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/feed") {
    console.log("WebSocket connection upgrade request received");
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});
// Optional logging
wss.on("connection", (ws) => {
  console.log("Desktop connected");
  ws.on("close", () => {
    console.log("Desktop disconnected");
  });
});
// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`HTTP + WebSocket server running on port ${PORT}`);
});