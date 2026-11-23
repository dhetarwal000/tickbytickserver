const { getSession } = require("../services/session");

async function getHistoricalOI(
  exchange,
  symboltoken,
  interval,
  fromdate,
  todate
) {
  const { smartApi } = await getSession();

  return smartApi.getOIData({
    exchange,
    symboltoken,
    interval,
    fromdate,
    todate,
  });
}

module.exports = {
  getHistoricalOI,
};