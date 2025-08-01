const fs = require("fs");
const path = require("path");

const tokenFile = path.join(__dirname, "../access_token.txt");

function getSavedToken() {
  if (fs.existsSync(tokenFile)) {
    const token = fs.readFileSync(tokenFile, "utf8").trim();
    console.log("Loaded access token:", token);
    return token;
  }
  console.log("Token file not found.");
  return null;
}

module.exports = { getSavedToken };
