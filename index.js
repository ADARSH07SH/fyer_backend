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

const fyers = new fyersModel({ path: path.join(__dirname, "logs") });
fyers.setAppId(FYERS_APP_ID);
fyers.setRedirectUrl(FYERS_REDIRECT_URL);

const tokenFile = path.join(__dirname, "access_token.txt");
const { getSavedToken } = require("./utils/fyertoken");
const apiKeyAuth = require("./middleware/apiKeyAuth");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.render("login"));

app.get("/login", (req, res) => {
  const authUrl = fyers.generateAuthCode();
  console.log("Generated Auth URL:", authUrl);
  res.redirect(authUrl);
});

app.get("/admin", async (req, res) => {
  const auth_code = req.query.auth_code;
  if (!auth_code) return res.status(400).send("Missing auth_code");

  try {
    const tokenResponse = await fyers.generate_access_token({
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_ID,
      auth_code,
    });

    if (tokenResponse.s === "ok") {
      fs.writeFileSync(tokenFile, tokenResponse.access_token);
      fyers.setAccessToken(tokenResponse.access_token);
      console.log("Access token saved:", tokenResponse.access_token);
      res.render("admin", { token: tokenResponse });
    } else {
      console.log("Token generation failed:", tokenResponse);
      res.status(500).send("Token generation failed.");
    }
  } catch (err) {
    console.error("Error generating token:", err.message);
    res.status(500).send("Error during token exchange.");
  }
});

app.get("/stockData/:stockname", apiKeyAuth, async (req, res) => {
  const token = getSavedToken();
  if (!token) {
    return res.status(401).json({ error: "Token missing. Login again." });
  }

  const stockname = req.params.stockname.toUpperCase();
  const symbol = `NSE:${stockname}-EQ`;
  fyers.setAccessToken(token);
  console.log(`Fetching quote for: ${symbol}`);

  try {
    const quote = await fyers.getQuotes([symbol]);
    console.log("Quote fetched:", quote);
    res.json(quote);
  } catch (err) {
    console.error("Error fetching quote:", err.message);
    res.status(500).json({ error: "Failed to fetch quote." });
  }
});

app.listen(PORT, () => {
  console.log(`FYERS Backend running at http://localhost:${PORT}`);
});
