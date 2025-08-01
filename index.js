const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const { fyersModel } = require("fyers-api-v3");

const connectDB = require("./config/db");
const FyersToken = require("./models/FyersToken");
const apiKeyAuth = require("./middleware/apiKeyAuth");

const app = express();
const PORT = process.env.PORT || 8080;

const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_ID = process.env.FYERS_SECRET_ID;
const FYERS_REDIRECT_URL = process.env.FYERS_REDIRECT_URL;

const fyers = new fyersModel({ path: path.join(__dirname, "logs") });
fyers.setAppId(FYERS_APP_ID);
fyers.setRedirectUrl(FYERS_REDIRECT_URL);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

connectDB();

app.get("/", (req, res) => res.render("login"));

app.get("/login", (req, res) => {
  const authUrl = fyers.generateAuthCode();
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
      const accessToken = tokenResponse.access_token;

      await FyersToken.findOneAndUpdate(
        {},
        { token: accessToken, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      fyers.setAccessToken(accessToken);
      res.render("admin", { token: tokenResponse });
    } else {
      res.status(500).send("Token generation failed.");
    }
  } catch (err) {
    res.status(500).send("Error during token exchange.");
  }
});

app.get("/stockData/:stockname", apiKeyAuth, async (req, res) => {
  const record = await FyersToken.findOne();

  if (!record || !record.token) {
    return res.status(401).json({ error: "Token missing. Login again." });
  }

  const token = record.token;
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
  console.log(`FYERS Backend running at http://localhost:${PORT}`);
});

app.get("/chartData/:stockname", apiKeyAuth, async (req, res) => {
  const record = await FyersToken.findOne();
  if (!record || !record.token) {
    return res.status(401).json({ error: "Token missing" });
  }

  const token = record.token;
  const stockname = req.params.stockname.toUpperCase();
  const symbol = `NSE:${stockname}-EQ`;

  fyers.setAccessToken(token);

  const start = new Date();
  start.setHours(9, 15, 0, 0);
  const end = new Date();
  end.setHours(15, 30, 0, 0);

  const range_from = Math.floor(start.getTime() / 1000);
  const range_to = Math.floor(end.getTime() / 1000);

  const inp = {
    symbol: symbol,
    resolution: "5",  
    date_format: "1",
    range_from,
    range_to,
    cont_flag: "1",
  };

  try {
    const response = await fyers.getHistory(inp);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chart data." });
  }
});

