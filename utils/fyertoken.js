const fs = require("fs");
const path = require("path");

const tokenFile = path.join(__dirname, "../access_token.txt");

function getSavedToken() {
  if (fs.existsSync(tokenFile)) {
    return fs.readFileSync(tokenFile, "utf8").trim();
  }
  return null;
}

module.exports = { getSavedToken };
