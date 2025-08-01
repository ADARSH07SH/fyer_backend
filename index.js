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






app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


app.get("/stock/:stockname", async (req, res) => {
  const stockname = req.params.stockname.toUpperCase();


  try {
    const quote = await fyers.getQuotes([`NSE${stockname}`]);
    
    console.log(stockname);
    console.log(quote);
    res.json(quote);
  } catch (error) {
    console.log(error);
  }
});
