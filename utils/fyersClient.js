const { fyersModel } = require("fyers-api-v3");

const fyers = new fyersModel({ enableLogging: true });

fyers.setAppId(process.env.FYERS_APP_ID);
fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URL);

module.exports = fyers;
