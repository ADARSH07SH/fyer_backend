require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const tickerSchema = new mongoose.Schema({
  source: String,
  symbol: String,
  name: String,
  series: String,
  isin: String,
  bseCode: String,
  faceValue: Number,
});

const Ticker = mongoose.model("Ticker", tickerSchema);

const nsePath = "D:/MS EDGE -DOWNLOADS/EQUITY_L.csv";
const bsePath = "D:/MS EDGE -DOWNLOADS/Equity.csv";


const normalizeHeader = (header) =>
  header?.toString().trim().toLowerCase().replace(/\s+/g, "_");

const readNSE = () => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(nsePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
        })
      )
      .on("data", (row) => {
        results.push({
          source: "NSE",
          symbol: row["symbol"],
          name: row["name_of_company"],
          series: row["series"],
          isin: row["isin_number"],
          faceValue: Number(row["face_value"] || 0),
        });
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

const readBSE = () => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(bsePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
        })
      )
      .on("data", (row) => {
        results.push({
          source: "BSE",
          bseCode: row["security_code"],
          symbol: row["security_id"],
          name: row["issuer_name"],
          isin: row["isin_no"],
          faceValue: Number(row["face_value"] || 0),
        });
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

const run = async () => {
  try {
    const nseData = await readNSE();
    const bseData = await readBSE();

    const allTickers = [...nseData, ...bseData];

    console.log(`Uploading ${allTickers.length} tickers to MongoDB...`);

    await Ticker.deleteMany();
    await Ticker.insertMany(allTickers);

    console.log(" Successfully inserted all ticker data.");
    mongoose.disconnect();
  } catch (err) {
    console.error(" Failed to upload tickers:", err);
    mongoose.disconnect();
  }
};

run();
