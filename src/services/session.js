const login = require("../services/angelLogin");

let session = null;

async function getSession() {
  if (!session) {
    //console.log("No active session. Logging in...");
    session = await login();
  }

  return session;
}

function setSession(newSession) {
  session = newSession;
}

function clearSession() {
  session = null;
}

module.exports = {
  getSession,
  setSession,
  clearSession,
};