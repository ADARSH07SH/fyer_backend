require("dotenv").config();

module.exports = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.FYER_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
