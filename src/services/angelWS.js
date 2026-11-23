const { WebSocketV2 } = require("smartapi-javascript");
const { appendTick ,flushBuffer} = require("./sheetsServicecrudeoil");
//newly added
const {broadcastTick} = require("../websocket/wsBroadcaster");
//till here
let ws = null;
let subscribedToken = null;
const buffer = [];
let subscribedExchangeType = null;
let currentSession = null;
let reconnecting = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let lastTickTime = Date.now();
let intentionallyClosed = false;
// Rolling buffers holding the last 20 ticks
const BUY_QTY_WINDOW = [];
const SELL_QTY_WINDOW = [];
const WINDOW_SIZE = 20;

function calculateSpreads(data) {
  const buy = data.best_5_buy_data;
  const sell = data.best_5_sell_data;

  if (!buy || !sell || buy.length < 5 || sell.length < 5) {
    return null;
  }

  const bestBid = Number(buy[0].price);
  const fifthBid = Number(buy[4].price);
  const bestAsk = Number(sell[0].price);
  const fifthAsk = Number(sell[4].price);

  const horizontalSpread = bestAsk - bestBid;
  const buyVerticalSpread = bestBid - fifthBid;
  const sellVerticalSpread = fifthAsk - bestAsk;
  const spreadDifference = buyVerticalSpread - sellVerticalSpread;

  // Raw Top 5 Buy / Sell Quantities
  const rawBest5BuyQty = buy.reduce(
    (sum, level) => sum + Number(level.quantity),
    0
  );
  const rawBest5SellQty = sell.reduce(
    (sum, level) => sum + Number(level.quantity),
    0
  );

  // Update sliding window for 20-tick Moving Average
  BUY_QTY_WINDOW.push(rawBest5BuyQty);
  if (BUY_QTY_WINDOW.length > WINDOW_SIZE) {
    BUY_QTY_WINDOW.shift();
  }

  SELL_QTY_WINDOW.push(rawBest5SellQty);
  if (SELL_QTY_WINDOW.length > WINDOW_SIZE) {
    SELL_QTY_WINDOW.shift();
  }

  // Calculate 20 Moving Average
  const best5BuyQty = Number(
    (BUY_QTY_WINDOW.reduce((sum, v) => sum + v, 0) / BUY_QTY_WINDOW.length).toFixed(2)
  );
  const best5SellQty = Number(
    (SELL_QTY_WINDOW.reduce((sum, v) => sum + v, 0) / SELL_QTY_WINDOW.length).toFixed(2)
  );

  const best5BuyOrders = buy.reduce(
    (sum, level) => sum + Number(level.no_of_orders),
    0
  );
  const best5SellOrders = sell.reduce(
    (sum, level) => sum + Number(level.no_of_orders),
    0
  );

  const AvgBuyOrderSize =
    best5BuyOrders > 0
      ? Number((best5BuyQty / best5BuyOrders).toFixed(2))
      : 0;
  const AvgSellOrderSize =
    best5SellOrders > 0
      ? Number((best5SellQty / best5SellOrders).toFixed(2))
      : 0;

  // Order Book Imbalance using 20 MA values
  const orderBookImbalance = Number((best5BuyQty - best5SellQty).toFixed(2));
  const avgOrderSizeDifference = Number((AvgBuyOrderSize - AvgSellOrderSize).toFixed(2));
  const best5OrderDifference = best5BuyOrders - best5SellOrders;
  const orderSizeRatio = AvgSellOrderSize > 0 ? Number((AvgBuyOrderSize / AvgSellOrderSize).toFixed(2)) : 0;
  const orderbookImbalanceRatio = best5SellQty > 0 ? Number((best5BuyQty / best5SellQty).toFixed(2)) : 0;

  return {
    horizontalSpread,
    buyVerticalSpread,
    sellVerticalSpread,
    spreadDifference,
    best5BuyQty,            // 20-tick Moving Average
    best5SellQty,           // 20-tick Moving Average
    rawBest5BuyQty,         // Kept in case you need sudden spike detection
    rawBest5SellQty,        // Kept in case you need sudden spike detection
    orderBookImbalance,
    best5BuyOrders,
    best5SellOrders,
    AvgBuyOrderSize,
    AvgSellOrderSize,
    avgOrderSizeDifference,
    best5OrderDifference,
    orderSizeRatio,
    orderbookImbalanceRatio
  };
}
/*function calculateSpreads(data) {
  const buy = data.best_5_buy_data;
  const sell = data.best_5_sell_data;
  if (!buy || !sell || buy.length < 5 || sell.length < 5) {
    return null;
  }
  const bestBid = Number(buy[0].price);
  const fifthBid = Number(buy[4].price);
  const bestAsk = Number(sell[0].price);
  const fifthAsk = Number(sell[4].price);
  const horizontalSpread = bestAsk - bestBid;
  const buyVerticalSpread = bestBid - fifthBid;
  const sellVerticalSpread = fifthAsk - bestAsk;
  const spreadDifference = buyVerticalSpread - sellVerticalSpread;
 const best5BuyQty = buy.reduce(
    (sum, level) => sum + Number(level.quantity),
    0
  );
const best5BuyOrders = buy.reduce(
  (sum, level) => sum + Number(level.no_of_orders),
  0
);
const best5SellOrders = sell.reduce(
  (sum, level) => sum + Number(level.no_of_orders),
  0
);
  // Sum of Best 5 Sell Quantity
  const best5SellQty = sell.reduce(
    (sum, level) => sum + Number(level.quantity),
    0
  );
const AvgBuyOrderSize =
  best5BuyOrders > 0
    ? Number((best5BuyQty / best5BuyOrders).toFixed(2))
    : 0;
const AvgSellOrderSize =
  best5SellOrders > 0
    ? Number((best5SellQty / best5SellOrders).toFixed(2))
    : 0;
     // Order Book Imbalance
  const orderBookImbalance =
    best5BuyQty - best5SellQty;
// average order size difference
const avgOrderSizeDifference = AvgBuyOrderSize - AvgSellOrderSize;
const best5OrderDifference = best5BuyOrders - best5SellOrders;
const orderSizeRatio = AvgBuyOrderSize / AvgSellOrderSize;
const orderbookImbalanceRatio = best5BuyQty / best5SellQty;

  return {
    horizontalSpread,
    buyVerticalSpread,
    sellVerticalSpread,
    spreadDifference,
    best5BuyQty,
    best5SellQty,
    orderBookImbalance,
    best5BuyOrders,
    best5SellOrders,
    AvgBuyOrderSize,
    AvgSellOrderSize,
    avgOrderSizeDifference,
    best5OrderDifference,
    orderSizeRatio,
    orderbookImbalanceRatio

  };
}*/
function connectWS(session, token, exchangeType) {  if (ws) {
    if (token && token !== subscribedToken) {
      subscribeToken(token, exchangeType);
    }
    return ws;
  }
  if (!session || !session.jwtToken) {
    throw new Error("Cannot connect WebSocket: invalid session or missing jwtToken");
  }
  const clientCode = (process.env.CLIENT_CODE || "").replace(/^["']|["']$/g, "").trim();
  const apiKey = (process.env.API_KEY || "").replace(/^["']|["']$/g, "").trim();
  ws = new WebSocketV2({
    clientcode: clientCode,
    jwttoken: session.jwtToken,
    apikey: apiKey,
    feedtype: session.feedToken,
  });
  ws.on(
    "tick",
    async (data) => {
      lastTickTime = Date.now();
      console.log(data)
      try {
        const spreads = calculateSpreads(data);
        appendTick(data, spreads);
        if (spreads) {
          broadcastTick(data, spreads);
        }
      } catch (err) {
        console.error("Error processing tick:", err.message);
      }
    },
  );
  ws.on(
    "error",
    (err) => {
      //  console.log("WS ERROR");
       console.log(err);
    },
  );
  ws.on(
    "close",
    () => {
      ws = null;
subscribedToken = null;
      // console.log("WS CLOSED");
      ws = null;
      subscribedToken = null;
    },
  );
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
function subscribeToken(token,exchangeType) {
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
// console.log(    "SUBSCRIBED",    token,  );
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
  // console.log(    "UNSUBSCRIBED",    subscribedToken,  );
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
  // console.log("WS CLOSED MANUALLY");
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
