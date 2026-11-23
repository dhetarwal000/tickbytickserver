const express = require("express");

const app = express();

app.use(express.json());

app.post("/start", async (req, res) => {  const tokens = req.body.tokens;
  await startMarketData(tokens);
  res.json({
    success: true,
  });
});

app.listen(3000, () => {
  console.log("Server started");
});
