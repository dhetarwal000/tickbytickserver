// wsBroadcaster.js
const WebSocket = require("ws");
const wss = new WebSocket.Server({ noServer: true });
let prevLtp = null;
let prevLtq = null;
let prevVolume = null;
// Running session totals
let oiChangeSum = 0;
let buySellSpreadSum = 0;
let orderBookImbalanceSum = 0;
let tickCount = 0;
// NEW
let avgOrderSpreadSum = 0;
let orderSpreadSum = 0;
//new
// Cumulative & tick-level volume metrics
let cumulativeBuyVolume = 0;
let cumulativeSellVolume = 0;
let lastKnownDirection = 1; // 1 for up, -1 for down
// Rolling window storage for ratio metrics
const rollingRatioBuffer = [];

function broadcastTick(data, spreads) {
    const ltp = Number(data.last_traded_price) / 100;
    const ltq = Number(data.last_traded_quantity);
    const volume = Number(data.vol_traded);
    // Ignore identical snapshots
    if (
        prevLtp === ltp &&
        prevLtq === ltq &&
        prevVolume === volume
    ) {
        return;
    }
      // --------------------------------------------------
  // PRICE SPREAD = CURRENT LTP - PREVIOUS LTP
  // --------------------------------------------------

  let Pricespread = 0;
  if (prevLtp !== null) {
    Pricespread = ltp - prevLtp;
  }
  let volumeDelta = 0;
  if (prevVolume !== null) {
    volumeDelta = volume - prevVolume;
  }

  let tickDirection = lastKnownDirection;
    if (Pricespread > 0) {
        tickDirection = 1;
        lastKnownDirection = 1;
    } else if (Pricespread < 0) {
        tickDirection = -1;
        lastKnownDirection = -1;
    }

    // Calculate Buy Volume and Sell Volume for this specific tick
    let tickBuyVolume = 0;
    let tickSellVolume = 0;

    if (volumeDelta > 0) {
        if (tickDirection === 1) {
            tickBuyVolume = volumeDelta;
            cumulativeBuyVolume += volumeDelta;
        } else {
            tickSellVolume = volumeDelta;
            cumulativeSellVolume += volumeDelta;
        }
    }

// SUM OF AVG ORDER SIZE DIFFERENCE
 avgOrderSpreadSum += Number(spreads.avgOrderSizeDifference) || 0;
  // SUM OF BEST 5 ORDER DIFFERENCE
  orderSpreadSum += Number(spreads.best5OrderDifference) || 0;
    prevLtp = ltp;
    prevLtq = ltq;
    prevVolume = volume;
    const oiChange = Number(data.open_interest_change);
    const horizontalSpread = spreads.horizontalSpread / 100;
    const buyVerticalSpread = spreads.buyVerticalSpread / 100;
    const sellVerticalSpread = spreads.sellVerticalSpread / 100;
    const spreadDifference = spreads.spreadDifference / 100;
    const orderBookImbalance = spreads.orderBookImbalance;
   // const orderSizeRatio = spreads.orderSizeRatio;
   // const orderbookImbalanceRatio = spreads.orderbookImbalanceRatio;


    addRatioSample(spreads.orderbookImbalanceRatio,spreads.orderSizeRatio);
const rollingRatios = getRollingAverageRatios(20);
const orderSizeRatio = rollingRatios.rollingAvgOrderSizeRatio;
const orderbookImbalanceRatio = rollingRatios.rollingAvgOrderbookImbalanceRatio;
    // Running totals
    oiChangeSum += oiChange;
    buySellSpreadSum += spreadDifference;
    orderBookImbalanceSum += orderBookImbalance;
    tickCount++;
    const payload = {
        time: new Date().toISOString(),
        token: data.token,
        ltp,
        ltq,
        avgPrice: Number(data.avg_traded_price) / 100,
        volume,
        oi: Number(data.open_interest),
        oiChange,
        horizontalSpread,
        buyVerticalSpread,
        sellVerticalSpread,
        spreadDifference,
        totalBuyQty: Number(data.total_buy_quantity),
        totalSellQty: Number(data.total_sell_quantity),
        best5BuyQty: spreads.best5BuyQty,
        best5SellQty: spreads.best5SellQty,
        orderBookImbalance,
        rawBest5BuyQty:spreads.rawBest5BuyQty,         // Kept in case you need sudden spike detection
    rawBest5SellQty:spreads.rawBest5SellQty,
        best5BuyOrders: spreads.best5BuyOrders,
        best5SellOrders: spreads.best5SellOrders,
        AvgBuyOrderSize: spreads.AvgBuyOrderSize,
        AvgSellOrderSize: spreads.AvgSellOrderSize,
        // ===== Running session totals =====
        oiChangeSum,
        buySellSpreadSum,
        orderBookImbalanceSum,
          // NEW VALUES
    Pricespread,
    avgOrderSpreadSum,
    orderSpreadSum,
    volumeDelta,
    orderSizeRatio,
    orderbookImbalanceRatio,
    tickBuyVolume,
        tickSellVolume,
        cumulativeBuyVolume,
        cumulativeSellVolume,

    };
   // console.log(payload.tickBuyVolume, payload.tickSellVolume, payload.cumulativeBuyVolume, payload.cumulativeSellVolume);
    const message = JSON.stringify(payload);
    //console.log(message);
   // console.log("Connected clients:", wss.clients.size);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
function resetSession() {
    prevLtp = null;
    prevLtq = null;
    prevVolume = null;
    oiChangeSum = 0;
    buySellSpreadSum = 0;
    orderBookImbalanceSum = 0;
    tickCount = 0;
    cumulativeBuyVolume = 0;
    cumulativeSellVolume = 0;
    lastKnownDirection = 1;
}
function addRatioSample(orderbookImbalanceRatio, orderSizeRatio) {
    rollingRatioBuffer.push({
        time: Date.now(),
        orderbookImbalanceRatio: Number(orderbookImbalanceRatio) || 0,
        orderSizeRatio: Number(orderSizeRatio) || 0,
    });
}

function pruneOldRatioSamples(windowSeconds) {
    const cutoff = Date.now() - windowSeconds * 1000;

    while (rollingRatioBuffer.length > 0 && rollingRatioBuffer[0].time < cutoff) {
        rollingRatioBuffer.shift();
    }
}

function getRollingAverageRatios(windowSeconds) {
    pruneOldRatioSamples(windowSeconds);

    if (rollingRatioBuffer.length === 0) {
        return {
            rollingAvgOrderbookImbalanceRatio: 0,
            rollingAvgOrderSizeRatio: 0,
            sampleCount: 0,
            windowSeconds,
        };
    }

    let orderbookImbalanceRatioSum = 0;
    let orderSizeRatioSum = 0;

    for (const sample of rollingRatioBuffer) {
        orderbookImbalanceRatioSum += sample.orderbookImbalanceRatio;
        orderSizeRatioSum += sample.orderSizeRatio;
    }

    return {
        rollingAvgOrderbookImbalanceRatio:
            orderbookImbalanceRatioSum / rollingRatioBuffer.length,
        rollingAvgOrderSizeRatio:
            orderSizeRatioSum / rollingRatioBuffer.length,
        sampleCount: rollingRatioBuffer.length,
        windowSeconds,
    };
}

module.exports = {
    wss,
    broadcastTick,
    resetSession
};