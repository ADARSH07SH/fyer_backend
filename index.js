const express = require("express");
require("dotenv").config();
const { fyersModel } = require("fyers-api-v3");

const app = express();
const PORT = 8080;


const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_ID = process.env.FYERS_SECRET_ID;
const FYERS_REDIRECT_URL = process.env.FYERS_REDIRECT_URL;

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");


app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const fyers = new fyersModel({
  path: "./logs",
  enableLogging: false,
});
fyers.setAppId(FYERS_APP_ID);
fyers.setRedirectUrl(FYERS_REDIRECT_URL);


app.get("/", (req, res) => {
  res.render("login");
});


app.get("/login", (req, res) => {
  try {
    const authUrl = fyers.generateAuthCode();
    console.log("Generated Auth URL:", authUrl);
    res.redirect(authUrl);
  } catch (err) {
    console.error("Error generating auth URL:", err);
    res.status(500).send("Failed to generate auth URL.");
  }
});


app.get("/admin", async (req, res) => {
  const auth_code = req.query.auth_code;
  if (!auth_code) return res.status(400).send("Missing auth_code from Fyers.");

  try {
    const tokenResponse = await fyers.generate_access_token({
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_ID,
      auth_code: auth_code,
    });

    console.log("Access Token:", tokenResponse);
    res.render("admin", { token: tokenResponse });
  } catch (err) {
    console.error("Error generating access token:", err);
    res.status(500).send("Token generation failed.");
  }
});

app.get("/profile", async (req, res) => {
  try {
    const response = await fyers.get_profile();
    res.json(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.get("/getquote", async (req, res) => {
  const symbols = req.query.symbols?.split(",") || [];
  try {
    const response = await fyers.getQuotes(symbols);
    res.json(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Quote fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
