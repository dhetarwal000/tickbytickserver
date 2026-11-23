const pool = require("../config/db");

async function insertTick(data, spreads) {
  const query = `
    INSERT INTO ticks (

      token,

      ltp,

      ltq,

      atp,

      volume,

      oi,

      oi_change,

      horizontal_spread,

      buy_vertical_spread,

      sell_vertical_spread,

      spread_difference,

      best_5_buy,

      best_5_sell,

      exchange_timestamp

    )

    VALUES (

      $1,$2,$3,$4,$5,

      $6,$7,$8,$9,$10,

      $11,$12,$13,$14

    )
  `;

  const values = [
    data.token,

    Number(data.last_traded_price),

    Number(data.last_traded_quantity),

    Number(data.avg_traded_price),

    Number(data.vol_traded),

    Number(data.open_interest),

    Number(data.open_interest_change),

    spreads.horizontalSpread,

    spreads.buyVerticalSpread,

    spreads.sellVerticalSpread,

    spreads.spreadDifference,

    JSON.stringify(data.best_5_buy_data),

    JSON.stringify(data.best_5_sell_data),

    Number(data.exchange_timestamp),
  ];

  await pool.query(query, values);
}

module.exports = {
  insertTick,
};
