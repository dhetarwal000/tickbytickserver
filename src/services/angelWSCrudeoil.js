const { WebSocketV2 } = require("smartapi-javascript");
const { appendTick, flushBuffer } = require("./sheetsServicecrudeoil");
const { broadcastTick } = require("../websocket/wsBroadcaster");

let ws = null;
let subscribedToken = null;
let subscribedExchangeType = null;
let currentSession = null;
let reconnecting = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let lastTickTime = Date.now();
let intentionallyClosed = false;

function cleanVal(v) {
  if (!v) return "";
  return String(v).replace(/^["']|["']$/g, "").trim();
}

function connectWS(session, token, exchangeType) {
  if (ws) {
    if (token && token !== subscribedToken) {
      subscribeToken(token, exchangeType);
    }
    return ws;
  }

  if (!session || !session.jwtToken) {
    throw new Error("Cannot connect WebSocket: invalid session or missing jwtToken");
  }

  currentSession = session;
  const clientCode = cleanVal(process.env.CLIENT_CODE);
  const apiKey = cleanVal(process.env.API_KEY);

  ws = new WebSocketV2({
    clientcode: clientCode,
    jwttoken: session.jwtToken,
    apikey: apiKey,
    feedtype: session.feedToken,
  });

  ws.on("tick", async (data) => {
    lastTickTime = Date.now();
    try {
      appendTick(data);
    } catch (err) {
      console.error("Error appending tick:", err.message);
    }
  });

  ws.on("error", (err) => {
    console.error("WS ERROR:", err);
  });

  ws.on("close", () => {
    console.log("WS CLOSED");
    ws = null;
    subscribedToken = null;
    subscribedExchangeType = null;
  });

  ws.connect()
    .then(() => {
      console.log("WS CONNECTED");
      if (token && exchangeType !== undefined) {
        subscribeToken(token, exchangeType);
      }
    })
    .catch((err) => {
      console.error("WS connect error:", err);
    });

  return ws;
}

function subscribeToken(token, exchangeType) {
  if (!ws) {
    throw new Error("WS not connected");
  }
  if (subscribedToken) {
    unsubscribeToken();
  }
  ws.fetchData({
    correlationID: "market",
    action: 1,
    mode: 3,
    exchangeType: exchangeType,
    tokens: [token],
  });
  subscribedToken = token;
  subscribedExchangeType = exchangeType;
  console.log(`SUBSCRIBED token: ${token}, exchangeType: ${exchangeType}`);
}

function unsubscribeToken() {
  if (!ws || !subscribedToken) {
    return;
  }
  ws.fetchData({
    correlationID: "market",
    action: 0,
    mode: 3,
    exchangeType: subscribedExchangeType,
    tokens: [subscribedToken],
  });
  console.log(`UNSUBSCRIBED token: ${subscribedToken}`);
  subscribedToken = null;
  subscribedExchangeType = null;
}

function closeWS() {
  if (!ws) {
    return;
  }
  unsubscribeToken();
  ws.close();
  ws = null;
  console.log("WS CLOSED MANUALLY");
}

function getWSStatus() {
  return {
    connected: ws !== null,
    token: subscribedToken,
  };
}

module.exports = {
  connectWS,
  subscribeToken,
  unsubscribeToken,
  closeWS,
  getWSStatus,
};
