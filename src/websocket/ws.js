const express = require("express");
const router = express.Router();
const wsBroadcaster = require("./wsBroadcaster");
router.get("/status", (req, res) => {
  res.json({
    connectedClients: wsBroadcaster.clientCount(),
  });
});
module.exports = router;