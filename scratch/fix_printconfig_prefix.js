const { MongoClient } = require('mongodb');

const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const LOCAL_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function fixPrintConfigPrefix(name, uri) {
  console.log(`\n⚙️ Fixing PrintConfig Invoice Prefix for '${name}'...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Update all PrintConfigs for EDP to have invoicePrefix: 'EDP/26-27/'
  const res = await db.collection('printconfigs').updateMany(
    {
      $or: [
        { companyEntity: 'Elite Online' },
        { companyEntity: 'Elite Digital Print' },
        { companyEntity: 'Elite Digital Prints' },
        { companyEntity: { $exists: false } },
        { isConfig: true }
      ]
    },
    {
      $set: {
        companyEntity: 'Elite Digital Print',
        invoicePrefix: 'EDP/26-27/',
        startingInvoiceNo: 223,
        companyName: 'ELITE DIGITAL PRINTS',
        companyGstin: '24AANFE0044M1ZG'
      }
    }
  );

  console.log(`  └─ Updated ${res.modifiedCount} PrintConfig records in '${name}' to prefix 'EDP/26-27/'.`);
  await client.close();
}

async function run() {
  await fixPrintConfigPrefix('Live Production (elite_edition)', LIVE_URI);
  await fixPrintConfigPrefix('Local Dev (elite_edition_local)', LOCAL_URI);
  console.log("\n🎉 PrintConfig Invoice Prefix ('EDP/26-27/') fixed on both Live & Local databases!");
}

run();
