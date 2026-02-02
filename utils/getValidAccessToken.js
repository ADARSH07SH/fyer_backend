const crypto = require("crypto");
const axios = require("axios");
const FyersToken = require("../models/FyersToken");

const REFRESH_URL = "https://api.fyers.in/api/v2/refresh-token";

async function getValidAccessToken() {
  const record = await FyersToken.findOne();
  if (!record) throw new Error("No FYERS token found");

  if (record.expiresAt && Date.now() < record.expiresAt) {
    return record.token;
  }

  const appIdHash = crypto
    .createHash("sha256")
    .update(`${process.env.FYERS_APP_ID}:${process.env.FYERS_SECRET_ID}`)
    .digest("hex");

  const res = await axios.post(REFRESH_URL, {
    grant_type: "refresh_token",
    appIdHash,
    refresh_token: record.refreshToken,
    pin: process.env.FYERS_PIN,
  });

  if (!res.data?.access_token) {
    throw new Error("Refresh token failed");
  }

  await FyersToken.updateOne(
    {},
    {
      token: res.data.access_token,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      updatedAt: new Date(),
    },
  );

  return res.data.access_token;
}

module.exports = getValidAccessToken;
