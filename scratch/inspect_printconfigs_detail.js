const { MongoClient } = require('mongodb');

const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const LOCAL_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectPrintConfigs(name, uri) {
  console.log(`\n⚙️ Inspecting PrintConfigs for '${name}'...`);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const configs = await db.collection('printconfigs').find({}).toArray();
    console.log(`Count: ${configs.length}`);
    configs.forEach((cfg, idx) => {
      console.log(`[${idx+1}] ID: ${cfg._id}`);
      console.log(`     companyEntity: '${cfg.companyEntity}'`);
      console.log(`     invoicePrefix: '${cfg.invoicePrefix}'`);
      console.log(`     startingInvoiceNo: ${cfg.startingInvoiceNo}`);
      console.log(`     companyName: '${cfg.companyName}'`);
      console.log(`     companyGstin: '${cfg.companyGstin}'`);
      console.log(`     isConfig: ${cfg.isConfig}`);
    });
  } catch (err) {
    console.error(`Error inspecting ${name}:`, err.message);
  } finally {
    await client.close();
  }
}

async function run() {
  await inspectPrintConfigs('Live Production (elite_edition)', LIVE_URI);
  await inspectPrintConfigs('Local Dev (elite_edition_local)', LOCAL_URI);
}

run();
