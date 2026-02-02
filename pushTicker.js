require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});

mongoose.connection.on("error", (err) => {
  console.error(" MongoDB connection error:", err);
});


const tickerSchema = new mongoose.Schema({
  source: { type: String, required: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  isin: { type: String, required: true },
});

const Ticker = mongoose.model("Ticker", tickerSchema);

const nsePath = "D:/MS EDGE -DOWNLOADS/EQUITY_L.csv";
const bsePath = "D:/MS EDGE -DOWNLOADS/Equity.csv";


const normalizeHeader = (header) =>
  header.toString().trim().toLowerCase().replace(/\s+/g, "_");

const clean = (val) => (val ? val.toString().trim() : "");

/*
NSE headers after normalize:
symbol
name_of_company
series
date_of_listing
paid_up_value
market_lot
isin_number
face_value

BSE headers after normalize:
security_code
issuer_name
security_id
security_name
status
group
face_value
isin_no
instrument
*/

/* ================= Read NSE CSV ================= */
const readNSE = () => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(nsePath)
      .pipe(csv({ mapHeaders: ({ header }) => normalizeHeader(header) }))
      .on("data", (row) => {
        const symbol = clean(row.symbol);
        const name = clean(row.name_of_company);
        const isin = clean(row.isin_number);

     
        if (!symbol || !name || !isin) return;

        results.push({
          source: "NSE",
          symbol,
          name,
          isin,
        });
      })
      .on("end", () => {
        console.log(`NSE valid records: ${results.length}`);
        resolve(results);
      })
      .on("error", reject);
  });
};


const readBSE = () => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(bsePath)
      .pipe(csv({ mapHeaders: ({ header }) => normalizeHeader(header) }))
      .on("data", (row) => {
        const symbol = clean(row.security_id);
        const name = clean(row.security_name);
        const isin = clean(row.isin_no);

        // Skip invalid rows
        if (!symbol || !name || !isin) return;

        results.push({
          source: "BSE",
          symbol,
          name,
          isin,
        });
      })
      .on("end", () => {
        console.log(`BSE valid records: ${results.length}`);
        resolve(results);
      })
      .on("error", reject);
  });
};


const run = async () => {
  try {
    const nseData = await readNSE();
    const bseData = await readBSE();

    const allTickers = [...nseData, ...bseData];

    console.log(`Uploading ${allTickers.length} tickers to MongoDB...`);

    await Ticker.deleteMany({});
    await Ticker.insertMany(allTickers);

    console.log(" Successfully inserted all ticker data!");
    mongoose.disconnect();
  } catch (err) {
    console.error(" Failed to upload tickers:", err);
    mongoose.disconnect();
  }
};

run();
