const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const { fyersModel } = require("fyers-api-v3");
const connectDB = require("./config/db");
const FyersToken = require("./models/FyersToken");
const apiKeyAuth = require("./middleware/apiKeyAuth");

const app = express();
const PORT = process.env.PORT || 8080;

const fyers = new fyersModel();
fyers.setAppId(process.env.FYERS_APP_ID);
fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URL);

const cache = new NodeCache({ stdTTL: process.env.CACHE_TTL || 30 });

const fyersRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.FYERS_RATE_LIMIT_PER_MINUTE || 180,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FyersRequestManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestCount = { perSecond: 0, perMinute: 0 };
    this.lastSecond = Math.floor(Date.now() / 1000);
    this.lastMinute = Math.floor(Date.now() / 60000);
  }

  async makeRequest(requestFn, retries = process.env.RETRY_ATTEMPTS || 3) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, retries, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const currentSecond = Math.floor(Date.now() / 1000);
      const currentMinute = Math.floor(Date.now() / 60000);

      if (currentSecond !== this.lastSecond) {
        this.requestCount.perSecond = 0;
        this.lastSecond = currentSecond;
      }

      if (currentMinute !== this.lastMinute) {
        this.requestCount.perMinute = 0;
        this.lastMinute = currentMinute;
      }

      if (
        this.requestCount.perSecond >=
          (process.env.FYERS_RATE_LIMIT_PER_SECOND || 8) ||
        this.requestCount.perMinute >=
          (process.env.FYERS_RATE_LIMIT_PER_MINUTE || 180)
      ) {
        await delay(1100);
        continue;
      }

      const { requestFn, retries, resolve, reject } = this.queue.shift();

      try {
        this.requestCount.perSecond++;
        this.requestCount.perMinute++;
        const result = await requestFn();
        resolve(result);
        await delay(100);
      } catch (error) {
        if (
          (error.message.includes("429") ||
            error.message.includes("Too Many Requests")) &&
          retries > 0
        ) {
          await delay(Math.pow(2, 4 - retries) * 1000);
          this.queue.unshift({
            requestFn,
            retries: retries - 1,
            resolve,
            reject,
          });
        } else {
          reject(error);
        }
      }
    }

    this.processing = false;
  }
}

const fyersManager = new FyersRequestManager();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key"
  );
  res.setHeader("User-Agent", "Mozilla/5.0 (compatible; StockApp/1.0)");
  next();
});

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

app.get(
  "/stockData/:stockname",
  fyersRateLimit,
  apiKeyAuth,
  async (req, res) => {
    const stockname = req.params.stockname.toUpperCase();
    const cacheKey = `stock_${stockname}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    const record = await FyersToken.findOne();
    if (!record?.token)
      return res.status(401).json({ error: "Token missing. Login again." });

    fyers.setAccessToken(record.token);
    const symbol = `NSE:${stockname}-EQ`;

    try {
      const quote = await fyersManager.makeRequest(async () =>
        fyers.getQuotes([symbol])
      );
      if (quote.s !== "ok")
        return res.status(500).json({ error: "FYERS quote failed" });
      cache.set(cacheKey, quote, process.env.CACHE_TTL || 30);
      res.json(quote);
    } catch (err) {
      res.status(500).json({ error: "Quote fetch failed" });
    }
  }
);

app.get("/getChart", fyersRateLimit, apiKeyAuth, async (req, res) => {
  const { symbol, resolution, range_from, range_to } = req.query;
  if (!symbol || !resolution || !range_from || !range_to)
    return res.status(400).json({ error: "Missing required query parameters" });

  const record = await FyersToken.findOne();
  if (!record?.token)
    return res.status(401).json({ error: "Token missing. Login again." });

  fyers.setAccessToken(record.token);

  try {
    const chartData = await fyersManager.makeRequest(async () =>
      fyers.getHistory({
        symbol: symbol.toUpperCase(),
        resolution,
        date_format: "0",
        range_from,
        range_to,
        cont_flag: "1",
      })
    );

    if (chartData.s !== "ok")
      return res
        .status(500)
        .json({ error: "FYERS chart fetch failed", details: chartData });
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ error: "Server error while fetching chart" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
