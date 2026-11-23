const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: "./keys/tickdatacrudeoil.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID_CRUDEOIL;

const buffer = [];
const BUFFER_LIMIT_MS = 10000; // 10-second buffer limit
const MAX_ROWS = 500;          // Safety limit to avoid excessive memory usage

// State tracking across raw ticks
let prevVolTraded = null;
let prevLtp = null;
let prevBestBid = null;
let prevBestAsk = null;
let lastKnownDirection = "BUY";

// Running Directional Volume
let periodBuyVolume = 0;
let periodSellVolume = 0;

let isFlushing = false;

// Formatters for IST Time
function getLocalISTTime() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function formatEpochToIST(epoch) {
  if (!epoch) return "";
  const num = Number(epoch);
  if (isNaN(num) || num === 0) return "";
  const ms = num > 1e11 ? num : num * 1000;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

// Flush to Google Sheets periodically every 10 seconds
setInterval(() => {
  flushBuffer().catch((err) => {
    console.error("Scheduled flush error:", err.message);
  });
}, BUFFER_LIMIT_MS);

/**
 * Appends every incoming raw tick to the buffer.
 * Processes raw market depth and tick data without skipping any packet.
 */
async function appendTick(data, spreads) {
  if (!data) return;

  const ltp = Number(data.last_traded_price || 0) / 100;
  const volTraded = Number(data.vol_traded || 0);
  const tradeTime = Number(data.last_traded_timestamp || 0);
  const rawLtq = Number(data.last_traded_quantity || 0);
  const token = String(data.token || "").replace(/"/g, "");

  // Level 1 to 5 Depths
  const buyDepth = data.best_5_buy_data || [];
  const sellDepth = data.best_5_sell_data || [];

  const topBidPrice = buyDepth[0]?.price ? Number(buyDepth[0].price) / 100 : ltp;
  const topAskPrice = sellDepth[0]?.price ? Number(sellDepth[0].price) / 100 : ltp;
  const lowestBidPrice = buyDepth.length > 0 ? Number(buyDepth[buyDepth.length - 1].price) / 100 : topBidPrice;
  const highestAskPrice = sellDepth.length > 0 ? Number(sellDepth[sellDepth.length - 1].price) / 100 : topAskPrice;

  const horizontalSpread = Math.max(0, topAskPrice - topBidPrice);
  const buyVerticalSpread = Math.max(0, topBidPrice - lowestBidPrice);
  const sellVerticalSpread = Math.max(0, highestAskPrice - topAskPrice);

  const b5BuyQty = buyDepth.reduce((acc, d) => acc + Number(d.quantity || 0), 0);
  const b5SellQty = sellDepth.reduce((acc, d) => acc + Number(d.quantity || 0), 0);
  const b5BuyOrders = buyDepth.reduce((acc, d) => acc + Number(d.no_of_orders || 0), 0);
  const b5SellOrders = sellDepth.reduce((acc, d) => acc + Number(d.no_of_orders || 0), 0);

  const avgBuyOrderSize = b5BuyOrders > 0 ? b5BuyQty / b5BuyOrders : 0;
  const avgSellOrderSize = b5SellOrders > 0 ? b5SellQty / b5SellOrders : 0;
  const orderBookImbalance = (b5BuyQty - b5SellQty) / (b5BuyQty + b5SellQty || 1);

  // Delta volume calculation
  let deltaVol = 0;
  if (prevVolTraded !== null) {
    deltaVol = Math.max(0, volTraded - prevVolTraded);
  }

  // Determine Aggressor Direction
  let tradeDirection;
  if (prevBestAsk !== null && ltp >= prevBestAsk) {
    tradeDirection = "BUY";
  } else if (prevBestBid !== null && ltp <= prevBestBid) {
    tradeDirection = "SELL";
  } else if (prevLtp !== null && ltp > prevLtp) {
    tradeDirection = "BUY";
  } else if (prevLtp !== null && ltp < prevLtp) {
    tradeDirection = "SELL";
  } else {
    tradeDirection = lastKnownDirection;
  }
  lastKnownDirection = tradeDirection;

  if (tradeDirection === "BUY") {
    periodBuyVolume += deltaVol;
  } else {
    periodSellVolume += deltaVol;
  }

  prevVolTraded = volTraded;
  prevLtp = ltp;
  prevBestBid = topBidPrice;
  prevBestAsk = topAskPrice;

  // Row format matching the 23 columns: Sheet1!A:W
  const row = [
    getLocalISTTime(),                       // Col A: Arrival IST Time
    token,                                   // Col B: Token
    formatEpochToIST(tradeTime),             // Col C: Trade Timestamp (IST)
    ltp,                                     // Col D: Price (LTP)
    deltaVol,                                // Col E: Delta Volume
    rawLtq,                                  // Col F: LTQ
    volTraded,                               // Col G: Total Cumulative Volume
    topBidPrice,                             // Col H: Best Bid
    topAskPrice,                             // Col I: Best Ask
    Number(horizontalSpread.toFixed(2)),     // Col J: Horizontal Spread
    Number(buyVerticalSpread.toFixed(2)),    // Col K: Buy Vertical Spread
    Number(sellVerticalSpread.toFixed(2)),   // Col L: Sell Vertical Spread
    tradeDirection,                          // Col M: BUY / SELL
    periodBuyVolume,                         // Col N: Period Buy Volume
    periodSellVolume,                        // Col O: Period Sell Volume
    Number(b5BuyQty.toFixed(1)),             // Col P: Top 5 Buy Qty
    Number(b5SellQty.toFixed(1)),            // Col Q: Top 5 Sell Qty
    Number(b5BuyOrders.toFixed(1)),          // Col R: Top 5 Buy Orders
    Number(b5SellOrders.toFixed(1)),         // Col S: Top 5 Sell Orders
    Number(avgBuyOrderSize.toFixed(2)),      // Col T: Avg Buy Order Size
    Number(avgSellOrderSize.toFixed(2)),     // Col U: Avg Sell Order Size
    Number(orderBookImbalance.toFixed(3)),   // Col V: Imbalance
    Number(data.open_interest || 0),         // Col W: Open Interest
  ];

  buffer.push(row);

  if (buffer.length >= MAX_ROWS) {
    await flushBuffer();
  }
}

/**
 * Atomically drains the buffer and appends to Google Sheets.
 */
async function flushBuffer() {
  if (isFlushing || !buffer.length) return;

  isFlushing = true;
  const values = buffer.splice(0, buffer.length);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:W",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    console.log(`[Google Sheets Crude Oil] Flushed ${values.length} rows to Sheet1`);
  } catch (err) {
    console.error("Error writing to Google Sheets:", err.message);
    buffer.unshift(...values); // Restore if network error
  } finally {
    isFlushing = false;
  }
}

module.exports = { appendTick, flushBuffer };
