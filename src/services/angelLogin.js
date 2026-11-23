require("dotenv").config();

const { SmartAPI } = require("smartapi-javascript");
const speakeasy = require("speakeasy");

function cleanVal(v) {
  if (!v) return "";
  return String(v).replace(/^["']|["']$/g, "").trim();
}

function mask(str) {
  if (!str) return "[EMPTY]";
  if (str.length <= 4) return "****";
  return str.substring(0, 2) + "***" + str.substring(str.length - 2);
}

async function login() {
  console.log("================== [ANGEL LOGIN START] ==================");
  console.log("[AngelLogin] Server UTC time:", new Date().toISOString());
  console.log("[AngelLogin] Server Epoch ms:", Date.now());

  const apiKey = cleanVal(process.env.API_KEY);
  const clientCode = cleanVal(process.env.CLIENT_CODE);
  const password = cleanVal(process.env.PASSWORD);
  const totpSecret = cleanVal(process.env.TOTP_SECRET);

  console.log("[AngelLogin] Env check:");
  console.log("  - API_KEY:", mask(apiKey), `(length: ${apiKey.length})`);
  console.log("  - CLIENT_CODE:", clientCode ? clientCode : "[EMPTY]");
  console.log("  - PASSWORD:", password ? `[SET, length: ${password.length}]` : "[EMPTY]");
  console.log("  - TOTP_SECRET:", mask(totpSecret), `(length: ${totpSecret.length})`);

  if (!apiKey || !clientCode || !password || !totpSecret) {
    const missing = [
      !apiKey && "API_KEY",
      !clientCode && "CLIENT_CODE",
      !password && "PASSWORD",
      !totpSecret && "TOTP_SECRET",
    ].filter(Boolean).join(", ");
    const errText = `Missing required credentials in environment: ${missing}`;
    console.error("[AngelLogin] CRITICAL:", errText);
    throw new Error(errText);
  }

  const smartApi = new SmartAPI({
    api_key: apiKey,
    timeout: 30000, // 30s timeout for cloud environments
  });

  let totp;
  try {
    totp = speakeasy.totp({
      secret: totpSecret,
      encoding: "base32",
    });
    console.log("[AngelLogin] Generated TOTP:", totp);
  } catch (totpErr) {
    console.error("[AngelLogin] Error generating TOTP with speakeasy:", totpErr.message);
    throw new Error(`Failed to generate TOTP: ${totpErr.message}`);
  }

  console.log(`[AngelLogin] Calling smartApi.generateSession for ${clientCode}...`);
  const startTime = Date.now();

  try {
    const response = await smartApi.generateSession(
      clientCode,
      password,
      totp,
    );

    const duration = Date.now() - startTime;
    console.log(`[AngelLogin] generateSession completed in ${duration}ms`);
    console.log("[AngelLogin] Raw response:", JSON.stringify(response, null, 2));

    if (!response) {
      throw new Error("No response returned from smartApi.generateSession");
    }

    if (response.status === false || !response.data || !response.data.jwtToken) {
      const errorReason =
        response.message ||
        response.error ||
        response.data?.message ||
        `Login failed (status: ${response.status}, errorcode: ${response.errorcode || response.errorCode || "none"})`;
      console.error("[AngelLogin] LOGIN FAILED. Reason:", errorReason);
      console.log("================== [ANGEL LOGIN END] ==================");
      throw new Error(errorReason);
    }

    console.log("[AngelLogin] LOGIN SUCCESS! jwtToken received (length:", response.data.jwtToken.length, ")");
    console.log("================== [ANGEL LOGIN END] ==================");

    return {
      smartApi,
      jwtToken: response.data.jwtToken,
      refreshToken: response.data.refreshToken,
      feedToken: response.data.feedToken,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[AngelLogin] Exception during generateSession after ${duration}ms:`, err.message);
    if (err.stack) console.error("[AngelLogin] Stack:", err.stack);
    console.log("================== [ANGEL LOGIN END] ==================");
    throw err;
  }
}

module.exports = login;
