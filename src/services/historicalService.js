const { getSession } = require("../services/session");

async function getHistoricalData(
  exchange,
  symboltoken,
  interval,
  fromdate,
  todate
) {
  const { smartApi } = await getSession();

  return smartApi.getCandleData({
    exchange,
    symboltoken,
    interval,
    fromdate,
    todate,
  });
}

module.exports = {
  getHistoricalData,
};