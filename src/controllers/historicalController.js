const {
  getHistoricalData,
} = require("../services/historicalService");

const {
  getHistoricalOI,
} = require("../services/oiService");

const {
  appendHistorical,
} = require("../services/sheetsService");

async function getHistorical(req, res) {
  try {

    const {
      exchange,
      symboltoken,
      interval,
      fromdate,
      todate,
    } = req.body;
//console.log(req.body);
    //----------------------------------
    // Fetch Candles
    //----------------------------------

   const candleResponse = await getHistoricalData(
  exchange,
  symboltoken,
  interval,
  fromdate,
  todate
);
//console.log(candleResponse);

if (
  candleResponse.status !== true ||
  !Array.isArray(candleResponse.data)
) {
  return res.status(400).json({
    success: false,
    angelResponse: candleResponse,
  });
}
//console.log(req.body)
const candles = candleResponse.data;

    //----------------------------------
    // Fetch OI only for Futures/Options
    //----------------------------------

    let oiMap = new Map();

    if (
      exchange === "NFO" ||
      exchange === "BFO"
    ) {

      const oiResponse =
        await getHistoricalOI(
          exchange,
          symboltoken,
          interval,
          fromdate,
          todate
        );

      if (
        oiResponse.status &&
        oiResponse.data
      ) {

        oiMap = new Map(

          oiResponse.data.map(

            item => [

              item.time,

              item.oi,

            ]

          )

        );

      }

    }

    //----------------------------------
    // Merge
    //----------------------------------

    const merged = candles.map(

      candle => [

        candle[0],

        candle[1],

        candle[2],

        candle[3],

        candle[4],

        candle[5],

        oiMap.get(candle[0]) ?? "",

      ]

    );

    //----------------------------------
    // Append to Google Sheet
    //----------------------------------

    await appendHistorical(
      merged
    );

    //----------------------------------

    res.json({

      success: true,

      rows: merged.length,

      data: merged,

    });

  }

  catch (err) {

   // console.error(err);

    res.status(500).json({

      success: false,

      message: err.message,

    });

  }

}
async function getHistoricalForServer(req, res) {
  try {

    const {
      exchange,
      symboltoken,
      interval,
      fromdate,
      todate,
    } = req.body;
//console.log(req.body);
    //----------------------------------
    // Fetch Candles
    //----------------------------------

   const candleResponse = await getHistoricalData(
  exchange,
  symboltoken,
  interval,
  fromdate,
  todate
);
//console.log( candleResponse);

if (
  candleResponse.status !== true ||
  !Array.isArray(candleResponse.data)
) {
  return res.status(400).json({
    success: false,
    angelResponse: candleResponse,
  });
}
//console.log(req.body)
const candles = candleResponse.data;

    //----------------------------------
    // Fetch OI only for Futures/Options
    //----------------------------------

    let oiMap = new Map();

    if (
      exchange === "NFO" ||
      exchange === "BFO"
    ) {

      const oiResponse =
        await getHistoricalOI(
          exchange,
          symboltoken,
          interval,
          fromdate,
          todate
        );

      if (
        oiResponse.status &&
        oiResponse.data
      ) {

        oiMap = new Map(

          oiResponse.data.map(

            item => [

              item.time,

              item.oi,

            ]

          )

        );

      }

    }

    //----------------------------------
    // Merge
    //----------------------------------

    const merged = candles.map(

      candle => [

        candle[0],

        candle[1],

        candle[2],

        candle[3],

        candle[4],

        candle[5],

        oiMap.get(candle[0]) ?? "",

      ]

    );

    //----------------------------------
    // Append to Google Sheet
    //----------------------------------



    //----------------------------------

    res.json({

      success: true,

      rows: merged.length,

      data: merged,

    });

  }

  catch (err) {

   // console.error(err);

    res.status(500).json({

      success: false,

      message: err.message,

    });

  }

}
module.exports = {

  getHistorical,getHistoricalForServer,

};