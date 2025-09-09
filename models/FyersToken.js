const mongoose = require("mongoose");

const FyersTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  refreshToken: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FyersToken", FyersTokenSchema);
