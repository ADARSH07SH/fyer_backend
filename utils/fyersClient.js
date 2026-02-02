const { fyersModel } = require("fyers-api-v3");

const fyers = new fyersModel({
  client_id: process.env.FYERS_APP_ID,
  redirect_uri: process.env.FYERS_REDIRECT_URL,
  response_type: "code",
  grant_type: "authorization_code",
});

module.exports = fyers;
