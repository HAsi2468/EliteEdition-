require('../src/polyfills/crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');

// Production Mongo URL
const prodUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

const parseQualityAndPanna = (qlty) => {
  if (!qlty) return { fabricQuality: '', panna: '' };
  qlty = qlty.trim();
  const match = qlty.match(/(.*)\s+(58["']?|36["']?|44["']?|48["']?|60["']?)$/i);
  if (match) {
    const rawPanna = match[2].replace(/['"]/g, '');
    return {
      fabricQuality: match[1].trim(),
      panna: rawPanna
    };
  }
  return { fabricQuality: qlty, panna: '' };
};

async function run() {
  await mongoose.connect(prodUrl);
  console.log('Connected to PRODUCTION MongoDB');

  // Load the parsed JSON
  const jsonPath = path.join(__dirname, 'fabric_data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('fabric_data.json does not exist. Run parse_fabric_numbers.py first.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const records = JSON.parse(rawData);
  console.log(`Loaded ${records.length} records from JSON`);

  // Clear existing June and July transactions in PRODUCTION
  const juneStart = new Date('2026-06-01T00:00:00.000Z');
  const julyEnd = new Date('2026-07-31T23:59:59.999Z');
  const deleteResult = await FabricTransaction.deleteMany({
    date: { $gte: juneStart, $lte: julyEnd }
  });
  console.log(`Deleted ${deleteResult.deletedCount} existing FabricTransactions in June and July 2026 (PRODUCTION).`);

  let inwardCount = 0;
  let outwardCount = 0;

  // Cache jobNo -> party to minimize db queries
  const jobCardCache = {};

  for (const item of records) {
    const { fabricQuality, panna } = parseQualityAndPanna(item.fabricQuality);

    // Create Inward Transaction
    const inwardTx = new FabricTransaction({
      type: 'INWARD',
      lotNo: item.lotNo,
      vendorName: item.vendorName,
      fabricQuality: fabricQuality,
      panna: panna,
      challanNo: item.challanNo,
      qty: item.qty,
      date: new Date(item.date),
      notes: `Imported from Fabric.numbers (${item.sheet})`
    });

    await inwardTx.save();
    inwardCount++;

    // Create Outward Transactions
    for (const out of item.outwards) {
      const outwardTx = new FabricTransaction({
        type: 'OUTWARD',
        lotNo: item.lotNo,
        fabricQuality: fabricQuality,
        panna: panna,
        qty: out.qty,
        jobNo: '-',
        challanNo: out.jobNo || '',
        notes: out.notes || `Imported from Fabric.numbers (${item.sheet})`,
        date: new Date(item.date),
        partyName: '-'
      });

      await outwardTx.save();
      outwardCount++;
    }
  }

  console.log(`Successfully imported ${inwardCount} INWARD and ${outwardCount} OUTWARD transactions into PRODUCTION!`);
  
  // Verify final counts
  const total = await FabricTransaction.countDocuments();
  console.log(`Total Fabric Transactions in Production now: ${total}`);
  
  await mongoose.connection.close();
}

run().catch(console.error);
