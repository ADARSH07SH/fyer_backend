const express = require("express");
require("dotenv").config();
const { fyersModel } = require("fyers-api-v3");
const path = require("path");

const app = express();
const PORT = 8080;

const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_ID = process.env.FYERS_SECRET_ID;
const FYERS_REDIRECT_URL = process.env.FYERS_REDIRECT_URL;

const fyers = new fyersModel({
  app_id: FYERS_APP_ID,
  redirect_uri: FYERS_REDIRECT_URL,
  secret_key: FYERS_SECRET_ID,
  enableLogging: false,
  path: "./logs",
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Show Login Button Page
app.get("/", (req, res) => {
  res.render("login");
});

// Redirect to FYERS Login
app.get("/login", (req, res) => {
  try {
    const authUrl = fyers.generateAuthCode();
    res.redirect(authUrl);
  } catch (err) {
    console.error("Error generating auth URL:", err);
    res.status(500).send("Failed to generate login URL.");
  }
});

// Callback after login
app.get("/admin", async (req, res) => {
  const { auth_code } = req.query;
  if (!auth_code) return res.status(400).send("Missing auth_code.");

  try {
    const tokenResponse = await fyers.generate_access_token({
      auth_code,
    });

    const access_token = tokenResponse.access_token;
    fyers.setAccessToken(access_token);

    res.render("admin", { token: access_token });
  } catch (err) {
    console.error("Token generation failed:", err);
    res.status(500).send("Access token generation failed.");
  }
});

// Profile API
app.get("/profile", async (req, res) => {
  try {
    const response = await fyers.get_profile();
    res.json(response);
  } catch (err) {
    console.error("Profile fetch failed:", err.message);
    res.status(500).json({ error: "Profile fetch failed" });
  }
});

// Quotes API
app.get("/getquote", async (req, res) => {
  const symbols = req.query.symbols?.split(",") || [];
  try {
    const response = await fyers.getQuotes(symbols);
    res.json(response);
  } catch (err) {
    console.error("Quote fetch failed:", err.message);
    res.status(500).json({ error: "Quote fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`FYERS auth server running at http://localhost:${PORT}`);
});
