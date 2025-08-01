const express = require("express");
require("dotenv").config();
const { fyersModel } = require("fyers-api-v3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;


const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_ID = process.env.FYERS_SECRET_ID;
const FYERS_REDIRECT_URL = process.env.FYERS_REDIRECT_URL;

const fyers = new fyersModel({
  path: path.join(__dirname, "logs"),
  enableLogging: false,
});

fyers.setAppId(FYERS_APP_ID);
fyers.setRedirectUrl(FYERS_REDIRECT_URL);

const tokenFile = path.join(__dirname, "access_token.txt");
const { getSavedToken } = require("./utils/fyertoken");
const apiKeyAuth = require("./middleware/apiKeyAuth");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Login + Token Save Flow
app.get("/", (req, res) => res.render("login"));

app.get("/login", (req, res) => {
  try {
    const authUrl = fyers.generateAuthCode();
    res.redirect(authUrl);
  } catch {
    res.status(500).send("Failed to generate auth URL.");
  }
});

app.get("/admin", async (req, res) => {
  const auth_code = req.query.auth_code;
  if (!auth_code) return res.status(400).send("Missing auth_code.");

  try {
    const tokenResponse = await fyers.generate_access_token({
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_ID,
      auth_code,
    });

    if (tokenResponse.s === "ok") {
      fs.writeFileSync(tokenFile, tokenResponse.access_token);
      fyers.setAccessToken(tokenResponse.access_token);
      res.render("admin", { token: tokenResponse });
    } else {
      res.status(500).send("Invalid access token response.");
    }
  } catch {
    res.status(500).send("Token generation failed.");
  }
});

// Main secure quote endpoint
app.get("/stock/:stockname", apiKeyAuth, async (req, res) => {
  const token = getSavedToken();
  if (!token) {
    return res.status(401).json({ error: "Token missing. Login required." });
  }

  const stockname = req.params.stockname.toUpperCase();
  const symbol = `NSE:${stockname}-EQ`;
  fyers.setAccessToken(token);

  try {
    const quote = await fyers.getQuotes([symbol]);
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch quote." });
  }
});

app.listen(PORT, () => {
  console.log(`FYERS Backend running on http://localhost:${PORT}`);
});
