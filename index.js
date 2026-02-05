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
const PORT = 3000;

connectDB();

app.set("trust proxy", 1);
app.listen(PORT, "0.0.0.0", () => console.log("Service started"));

const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_TTL) || 30 });

const fyersRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.FYERS_RATE_LIMIT_PER_MINUTE) || 180,
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  next();
});


app.get("/", (_, res) => res.render("login"));
app.get("/login", (_, res) => res.redirect(fyers.generateAuthCode()));


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


app.get("/stockData/:stock", fyersRateLimit, apiKeyAuth, async (req, res) => {
  try {
    const rawStock = req.params.stock.toUpperCase();

    const fyersSymbol =
      rawStock.startsWith("NSE:") && rawStock.endsWith("-EQ")
        ? rawStock
        : rawStock.startsWith("NSE:")
          ? rawStock + "-EQ"
          : `NSE:${rawStock}-EQ`;

    const cacheKey = `stock_${fyersSymbol}`;

    if (cache.has(cacheKey)) {
      return res.type("json").json(cache.get(cacheKey));
    }

    const token = await getValidAccessToken();
    fyers.setAccessToken(token);

    const quote = await fyers.getQuotes([fyersSymbol]);
    if (quote.s !== "ok") {
      return res.status(502).json({ error: "Fyers quote failed", data: quote });
    }

    cache.set(cacheKey, quote);
    res.type("json").json(quote);
  } catch (err) {
    res.status(500).type("json").json({ error: err.message });
  }
});

app.get("/getChart", fyersRateLimit, apiKeyAuth, async (req, res) => {
  try {
    const { symbol, resolution, range_from, range_to } = req.query;
    if (!symbol || !resolution || !range_from || !range_to) {
      return res.status(400).json({ error: "Missing params" });
    }

    const fyersSymbol = symbol.toUpperCase().startsWith("NSE:")
      ? symbol.toUpperCase()
      : `NSE:${symbol.toUpperCase()}-EQ`;

    const token = await getValidAccessToken();
    fyers.setAccessToken(token);

    const chart = await fyers.getHistory({
      symbol: fyersSymbol,
      resolution,
      date_format: "0",
      range_from,
      range_to,
      cont_flag: "1",
    });

    if (chart.s !== "ok") {
      return res.status(502).json({ error: "Fyers chart failed", data: chart });
    }

    res.type("json").json(chart);
  } catch (err) {
    res.status(500).type("json").json({ error: err.message });
  }
});


app.get("/wakeupserver", (_, res) => res.json({ message: "Server awake" }));


app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .type("json")
    .json({
      error: err.message || "Internal Server Error",
    });
});
