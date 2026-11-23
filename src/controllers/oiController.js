const {
  getHistoricalOI,
} = require("../services/oiService");
const { appendOI } = require("../services/sheetsService");

async function getOI(req, res) {

 // console.log(req.query);
console.log( req.body.exchange,
      req.body.symboltoken,
      req.body.interval,
      req.body.fromdate,
      req.body.todate)
  try {
    const response = await getHistoricalOI(
      req.body.exchange,
      req.body.symboltoken,
      req.body.interval,
      req.body.fromdate,
      req.body.todate
    );
  console.log(response)
 /*if (response.status && response.data) {
      await appendOI(response);
    }*/
console.log("OI response:", response); // Send response to Next.js / caller
return res.json(response);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  getOI,
};