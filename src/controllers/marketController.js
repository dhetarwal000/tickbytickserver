const login = require("../services/angelLogin");
const {
  setSession,
  clearSession,
} = require("../services/session");
const {
  connectWS,
  closeWS,
  subscribeToken,
  unsubscribeToken,
  getWSStatus,
} = require("../services/angelWSCrudeoil");
const {
  scheduleStop,
} = require("../utils/markertScheduler");

let running = false;
let currentToken = null;

async function startMarketData(req, res) {
  console.log("------------------ [/start REQUEST RECEIVED] ------------------");
  console.log("[startMarketData] Request Body:", JSON.stringify(req.body));
  console.log("[startMarketData] Running state:", running, "currentToken:", currentToken);

  try {
    if (running) {
      scheduleStop(internalStop);
      console.log("[startMarketData] Server is already running. Returning success.");
      return res.json({
        success: true,
        message: "Already Running",
      });
    }

    const { token, exchangeType } = req.body;
    if (!token || exchangeType === undefined) {
      console.warn("[startMarketData] Missing token or exchangeType in request body:", req.body);
      return res.status(400).json({
        success: false,
        message: "token and exchangeType are required",
      });
    }

    console.log(`[startMarketData] Initiating Angel One login for token ${token}, exchangeType ${exchangeType}...`);
    const session = await login();

    console.log("[startMarketData] Session established. Storing globally and connecting WS...");
    setSession(session);

    await connectWS(
      session,
      token,
      exchangeType
    );

    running = true;
    currentToken = token;
    scheduleStop(internalStop);

    console.log("[startMarketData] Market data started successfully for token:", token);
    console.log("------------------ [/start SUCCESS] ------------------");
    res.json({
      success: true,
      token,
      exchangeType,
    });
  } catch (err) {
    console.error("[startMarketData] ERROR occurred:", err.message);
    if (err.stack) console.error("[startMarketData] Stack:", err.stack);
    console.log("------------------ [/start FAILED] ------------------");
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

function internalStop() {
  try {
    console.log("[internalStop] Stopping market data and closing WS...");
    closeWS();
  } catch (err) {
    console.error("[internalStop] Error closing WS:", err.message);
  }
  clearSession();
  running = false;
  currentToken = null;
  console.log("[internalStop] Stopped cleanly.");
}

function stopMarketData(req, res) {
  console.log("[stopMarketData] Stop request received.");
  internalStop();
  res.json({
    success: true,
  });
}

function subscribe(req, res) {
  try {
    const { token, exchangeType } = req.body;
    console.log(`[subscribe] Request to subscribe token: ${token}, exchangeType: ${exchangeType}`);
    if (!token || exchangeType === undefined) {
      return res.status(400).json({
        success: false,
        message: "token and exchangeType are required",
      });
    }
    unsubscribeToken();
    subscribeToken(
      token,
      exchangeType
    );
    currentToken = token;
    res.json({
      success: true,
      token,
      exchangeType,
    });
  } catch (err) {
    console.error("[subscribe] Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

function unsubscribe(req, res) {
  try {
    console.log("[unsubscribe] Request to unsubscribe current token.");
    unsubscribeToken();
    currentToken = null;
    res.json({
      success: true,
    });
  } catch (err) {
    console.error("[unsubscribe] Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

function status(req, res) {
  const wsStatus = getWSStatus();
  console.log("[status] Current status:", { running, currentToken, wsStatus });
  res.json({
    running,
    currentToken,
    wsStatus,
  });
}

module.exports = {
  startMarketData,
  stopMarketData,
  subscribe,
  unsubscribe,
  status,
};
