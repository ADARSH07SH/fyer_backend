const { fyersModel } = require("fyers-api-v3");
const FyersToken = require("../models/FyersToken");

const fyers = new fyersModel();
fyers.setAppId(process.env.FYERS_APP_ID);
fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URL);

async function refreshAccessToken() {
  const record = await FyersToken.findOne();
  if (!record?.refreshToken) throw new Error("Refresh token is missing in DB.");

  const tokenResponse = await fyers.refresh_access_token({
    client_id: process.env.FYERS_APP_ID,
    secret_key: process.env.FYERS_SECRET_ID,
    refresh_token: record.refreshToken,
  });

  if (tokenResponse.s === "ok") {
    await FyersToken.findOneAndUpdate(
      {},
      {
        token: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    fyers.setAccessToken(tokenResponse.access_token);
    return tokenResponse.access_token;
  } else {
    throw new Error("Failed to refresh access token.");
  }
}

module.exports = { refreshAccessToken, fyers };
