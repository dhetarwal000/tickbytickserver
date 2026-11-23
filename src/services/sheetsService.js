const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: "./keys/google-service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
//console.log("SPREADSHEET_ID", SPREADSHEET_ID);
const buffer = [];
const MAX_ROWS = 100;

let prevLtp = null;
let prevHorizontalSpread = null;
let prevBuySpread = null;
let prevSellSpread = null;
let avgOrderSpreadSum = 0;
let orderSpreadSum = 0;
setInterval(() => {
  flushBuffer().catch(console.error);
}, 7000);

// Flush every 5 seconds (or whenever MAX_ROWS reached)

async function appendTick(data, spreads) {

  const ltp = Number(data.last_traded_price) / 100;

  const horizontalSpread = spreads.horizontalSpread / 100;
  const buySpread = spreads.buyVerticalSpread / 100;
  const sellSpread = spreads.sellVerticalSpread / 100;



  if (
    prevLtp === ltp &&
    prevHorizontalSpread === horizontalSpread &&
    prevBuySpread === buySpread &&
    prevSellSpread === sellSpread
  ) {
    return;
  }
  let Pricespread = 0;
 if (prevLtp !== null) {
    Pricespread = ltp - prevLtp;
  }
    // SUM OF AVG ORDER SIZE DIFFERENCE
  avgOrderSpreadSum += Number(spreads.avgOrderSizeDifference) || 0;
 // SUM OF BEST 5 ORDER DIFFERENCE
   orderSpreadSum += Number(spreads.best5OrderDifference) || 0;
  // Ignore identical market snapshot
  prevLtp = ltp;
  prevHorizontalSpread = horizontalSpread;
  prevBuySpread = buySpread;
  prevSellSpread = sellSpread;

  buffer.push([
   new Date().toISOString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour12: false,
  Date: false
}),
    data.token,
    ltp,
    Number(data.last_traded_quantity),
    Number(data.avg_traded_price) / 100,
    Number(data.vol_traded),
    Number(data.open_interest),
    Number(data.open_interest_change),
    horizontalSpread,
    buySpread,
    sellSpread,
    spreads.spreadDifference / 100,
    Number(data.total_buy_quantity),
    Number(data.total_sell_quantity),
    spreads.best5BuyQty,
    spreads.best5SellQty,
    spreads.orderBookImbalance,
    spreads.best5BuyOrders,
    spreads.best5SellOrders,
    spreads.AvgBuyOrderSize,
    spreads.AvgSellOrderSize,
      // NEW VALUES
    Pricespread,
    avgOrderSpreadSum,
    orderSpreadSum

  ]);

  if (buffer.length >= MAX_ROWS) {
    await flushBuffer();
  }
}

async function flushBuffer() {

  if (!buffer.length) return;

  const values = [...buffer];
  buffer.length = 0;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A:X",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values
    }
  });

}

module.exports = {
  appendTick,
  flushBuffer,
};