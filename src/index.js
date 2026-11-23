require("dotenv").config();
const express = require("express");
const {
  startMarketData,
  stopMarketData,
  status,
  subscribe,
  unsubscribe,
} = require("./controllers/marketController");
const {
  getHistorical,
  getHistoricalForServer
} = require("./controllers/historicalController");
const {
  getOI,
} = require("./controllers/oiController");
const app = express();
app.use(express.json());
app.post(
  "/start",
  startMarketData,
);
app.post(
  "/stop",
  stopMarketData,
);
app.post(
  "/subscribe",
  subscribe,
);
app.post("/historical", getHistorical);
//will be used using local market-analyzer desktop app to get historical data for a specific server
app.post("/historicalForServer", getHistoricalForServer);
app.get("/oi", getOI);
app.post(
  "/unsubscribe",
  unsubscribe,
);
app.get(
  "/status",
  status,
);
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: {
      API_KEY: process.env.API_KEY ? "SET" : "MISSING",
      CLIENT_CODE: process.env.CLIENT_CODE ? "SET" : "MISSING",
      PASSWORD: process.env.PASSWORD ? "SET" : "MISSING",
      TOTP_SECRET: process.env.TOTP_SECRET ? "SET" : "MISSING",
      SPREADSHEET_ID_CRUDEOIL: process.env.SPREADSHEET_ID_CRUDEOIL ? "SET" : "MISSING",
    },
  });
});
const PORT = process.env.PORT || 3000;
app.listen(
  PORT,
  () => {
    console.log(`==================================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment check: API_KEY=${process.env.API_KEY ? "OK" : "MISSING"}, CLIENT_CODE=${process.env.CLIENT_CODE ? "OK" : "MISSING"}`);
    console.log(`==================================================`);
  },
);
