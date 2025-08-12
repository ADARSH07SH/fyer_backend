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

const fyers = new fyersModel();
fyers.setAppId(process.env.FYERS_APP_ID);
fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URL);

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
      client_id: process.env.FYERS_APP_ID,
      secret_key: process.env.FYERS_SECRET_ID,
      auth_code,
    });

    if (tokenResponse.s === "ok") {
      await FyersToken.findOneAndUpdate(
        {},
        { token: tokenResponse.access_token, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      fyers.setAccessToken(tokenResponse.access_token);
      res.render("admin", { token: tokenResponse });
    } else {
      res.status(500).send("Token generation failed.");
    }
  } catch {
    res.status(500).send("Error during token exchange.");
  }
});

app.get("/stockData/:stockname", apiKeyAuth, async (req, res) => {


  const record = await FyersToken.findOne();
  if (!record?.token) {
    return res.status(401).json({ error: "Token missing. Login again." });
  }

  fyers.setAccessToken(record.token);
  const stockname = req.params.stockname.toUpperCase();
  const symbol = `NSE:${stockname}-EQ`;

  try {
    const quote = await fyers.getQuotes([symbol]);

    if (quote.s !== "ok") {
      return res.status(500).json({ error: "FYERS quote failed" });
    }

    const data = quote.d?.[0];
    if (!data?.v) {
      return res.status(500).json({ error: "Invalid quote format" });
    }

    return res.json(quote);

  } catch (err) {
    res.status(500).json({ error: "Quote fetch failed" });
  }
});

app.get("/getChart", apiKeyAuth, async (req, res) => {
  const { symbol, resolution, range_from, range_to } = req.query;

  if (!symbol || !resolution || !range_from || !range_to) {
    return res.status(400).json({
      error:
        "Missing required query parameters: symbol, resolution, range_from, range_to",
    });
  }

  try {
    const record = await FyersToken.findOne();
    if (!record?.token) {
      return res.status(401).json({ error: "Token missing. Login again." });
    }

    fyers.setAccessToken(record.token);

    const inp = {
      symbol: symbol.toUpperCase(), 
      resolution: resolution, 
      date_format: "0",
      range_from: range_from, 
      range_to: range_to, 
      cont_flag: "1",
    };

    const chartData = await fyers.getHistory(inp);

    if (chartData.s !== "ok") {
      return res
        .status(500)
        .json({ error: "FYERS chart fetch failed", details: chartData });
    }

    return res.json(chartData);
  } catch (err) {
    console.error("Error fetching chart:", err);
    res.status(500).json({ error: "Server error while fetching chart data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

