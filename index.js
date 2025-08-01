const express = require("express");
require("dotenv").config();
const { fyersModel } = require("fyers-api-v3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// FYERS Credentials and SDK setup
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_ID = process.env.FYERS_SECRET_ID;
const FYERS_REDIRECT_URL = process.env.FYERS_REDIRECT_URL;

const fyers = new fyersModel({
  path: path.join(__dirname, "logs"),
  enableLogging: false,
});

fyers.setAppId(FYERS_APP_ID);
fyers.setRedirectUrl(FYERS_REDIRECT_URL);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
  res.render("login");
});

app.get("/login", (req, res) => {
  try {
    const authUrl = fyers.generateAuthCode();
    res.redirect(authUrl);
  } catch (err) {
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
      auth_code: auth_code,
    });
    if (tokenResponse.s === "ok") {
      fyers.setAccessToken(tokenResponse.access_token);
      res.render("admin", { token: tokenResponse });
    } else {
      res.status(500).send("Could not get valid access token.");
    }
  } catch (err) {
    res.status(500).send("Token generation failed.");
  }
});


app.get("/profile", async (req, res) => {
  try {
    const response = await fyers.get_profile();
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: "Profile fetch failed" });
  }
});


app.get("/api/quote", async (req, res) => {
  const symbols = req.query.symbols ? req.query.symbols.split(",") : [];
  if (!symbols.length) {
    return res.status(400).json({ error: "No symbols provided" });
  }
  try {
    const quotes = await fyers.getQuotes(symbols);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: "Quote fetch failed" });
  }
});


app.get("/api/depth", async (req, res) => {
  const symbols = req.query.symbols ? req.query.symbols.split(",") : [];
  if (!symbols.length) {
    return res.status(400).json({ error: "No symbols provided" });
  }
  try {
    
    const results = {};
    for (const symbol of symbols) {
      results[symbol] = await fyers.getMarketDepth({
        symbol: [symbol],
        ohlcv_flag: 1,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Market depth fetch failed" });
  }
});

// Historical OHLCV/candle data
app.get("/api/history", async (req, res) => {
  const { symbol, resolution, range_from, range_to } = req.query;
  if (!symbol || !resolution || !range_from || !range_to) {
    return res
      .status(400)
      .json({ error: "symbol, resolution, range_from, and range_to required" });
  }
  try {
    const data = await fyers.getHistorical({
      symbol,
      resolution,
      range_from,
      range_to,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "History fetch failed" });
  }
});

// ---------- Example: default symbols quotes for quick test ----------
app.get("/getquote", async (req, res) => {
  try {
    const quotes = await fyers.getQuotes(["NSE:SBIN-EQ", "NSE:TCS-EQ"]);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: "Quote fetch failed" });
  }
});

// Optional: search / symbol master (for user-friendly search)
app.get("/api/search", async (req, res) => {
  const query = req.query.query ? req.query.query.toUpperCase() : "";
  // For now, you can use a static or locally cached symbol master file
  // FYERS API provides symbol master, or you can use a CSV/JSON mapping
  // Respond with matches for symbol/name/segment, etc.
  res.json({ error: "Not implemented. Add symbol master search logic here." });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


app.get("/stock/:stockname", async (req, res) => {
  const stockname = req.params.stockname.toUpperCase();

  try {
    const quote = await fyers.getQuotes([`NSE${stockname}`]);

    console.log(stockname);
    console.log(quote.d);
    res.json(quote);
  } catch (error) {
    console.log(error);
  }
});