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

const fyers = new fyersModel();
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

    if (quote.s !== "ok") {
      console.error("FYERS quote error:", quote.message || quote);
      return res.status(500).json({ error: "FYERS quote failed" });
    }

    const quoteData = quote.d?.[0]?.v;

    if (!quoteData) {
      console.error("Invalid quote format", quote);
      return res.status(500).json({ error: "Invalid quote format" });
    }

    console.log("Live Quote for", symbol, ":", quoteData);

    return res.json({
      symbol: quote.d[0].n,
      lastPrice: quoteData.last_price,
      open: quoteData.open_price,
      high: quoteData.high_price,
      low: quoteData.low_price,
      prevClose: quoteData.prev_close_price,
      volume: quoteData.volume,
      totalBuyQty: quoteData.total_buy_qty,
      totalSellQty: quoteData.total_sell_qty,
      averageTradePrice: quoteData.average_trade_price,
      lowerCircuit: quoteData.lower_circuit_limit,
      upperCircuit: quoteData.upper_circuit_limit,
    });
  } catch (err) {
    console.error("Quote fetch failed:", err.message || err);
    res.status(500).json({ error: "Quote fetch failed" });
  }
});
