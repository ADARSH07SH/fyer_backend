const FyersToken = require("../models/FyersToken");
const fyers = require("./fyersClient");

async function getValidAccessToken() {
  const record = await FyersToken.findOne();
  if (!record) throw new Error("No FYERS token found");

  if (record.expiresAt && Date.now() < record.expiresAt) {
    return record.token;
  }

  const response = await fyers.generate_access_token({
    grant_type: "refresh_token",
    refresh_token: record.refreshToken,
  });

  if (response.s !== "ok") {
    throw new Error("Refresh token failed");
  }

  await FyersToken.updateOne(
    {},
    {
      token: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      updatedAt: new Date(),
    },
  );

  return response.access_token;
}

module.exports = getValidAccessToken;
