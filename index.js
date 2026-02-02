require("dotenv").config();
const express = require("express");
const path = require("path");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const FyersToken = require("./models/FyersToken");
const apiKeyAuth = require("./middleware/apiKeyAuth");

const fyers = require("./utils/fyersClient");
const getValidAccessToken = require("./utils/getValidAccessToken");

const app = express();
const INTERNAL_PORT = 3000;

app.listen(INTERNAL_PORT, "0.0.0.0", () => {
  console.log("Service started");
});

connectDB();

// ---------------- BASIC SETUP ----------------
const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_TTL) || 30 });

const fyersRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.FYERS_RATE_LIMIT_PER_MINUTE) || 180,
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  next();
});

// ---------------- ROUTES ----------------

app.get("/", (_, res) => res.render("login"));

app.get("/login", (_, res) => {
  res.redirect(fyers.generateAuthCode());
});

// 🔑 FIRST LOGIN
app.get("/admin", async (req, res) => {
  const auth_code = req.query.auth_code;
  if (!auth_code) return res.status(400).send("Missing auth_code");

  const tokenResponse = await fyers.generate_access_token({
    client_id: process.env.FYERS_APP_ID,
    secret_key: process.env.FYERS_SECRET_ID,
    auth_code,
  });

  if (tokenResponse.s !== "ok") {
    return res.status(500).send("Token generation failed");
  }

  await FyersToken.findOneAndUpdate(
    {},
    {
      token: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      updatedAt: new Date(),
    },
    { upsert: true },
  );

  res.render("admin");
});

// ---------------- STOCK DATA ----------------
app.get("/stockData/:stock", fyersRateLimit, apiKeyAuth, async (req, res) => {
  const stock = req.params.stock.toUpperCase();
  const cacheKey = `stock_${stock}`;

  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    const token = await getValidAccessToken();
    fyers.setAccessToken(token);

    const quote = await fyers.getQuotes([`NSE:${stock}-EQ`]);
    if (quote.s !== "ok") throw new Error();

    cache.set(cacheKey, quote);
    res.json(quote);
  } catch {
    res.status(500).json({ error: "Stock fetch failed" });
  }
});

// ---------------- CHART ----------------
app.get("/getChart", fyersRateLimit, apiKeyAuth, async (req, res) => {
  const { symbol, resolution, range_from, range_to } = req.query;
  if (!symbol || !resolution || !range_from || !range_to) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const token = await getValidAccessToken();
    fyers.setAccessToken(token);

    const chart = await fyers.getHistory({
      symbol: symbol.toUpperCase(),
      resolution,
      date_format: "0",
      range_from,
      range_to,
      cont_flag: "1",
    });

    if (chart.s !== "ok") throw new Error();
    res.json(chart);
  } catch {
    res.status(500).json({ error: "Chart fetch failed" });
  }
});

app.get("/wakeupserver", (_, res) => res.json({ message: "Server awake" }));
