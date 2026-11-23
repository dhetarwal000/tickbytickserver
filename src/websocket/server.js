const http = require("http");
const app = express();
const server = http.createServer(app);
const wsBroadcaster = require("./wsBroadcaster");
wsBroadcaster.init(server);
server.listen(3001, () => {
  console.log("Server running");
});
app.use("/ws", require("./ws"));