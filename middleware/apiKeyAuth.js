require("dotenv").config();

module.exports = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  console.log("Incoming API Key:", apiKey);

  if (!apiKey || apiKey !== process.env.FYER_API_KEY) {
    console.log("Unauthorized request. Invalid or missing API key.");
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};
