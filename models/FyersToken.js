const mongoose = require("mongoose");

const fyersTokenSchema = new mongoose.Schema({
  token: String,
  refreshToken: String,
  expiresAt: Number, // timestamp
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FyersToken", fyersTokenSchema);
