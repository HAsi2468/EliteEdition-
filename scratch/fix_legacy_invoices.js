const { MongoClient } = require('mongodb');

const liveUri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const localDevUri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function fixInvoices(name, uri) {
  console.log(`\n🔧 Fixing legacy invoices for database '${name}'...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Set companyEntity = 'Elite Digital Print' on all invoices missing companyEntity or matching EDP
  const result = await db.collection('billinginvoices').updateMany(
    {
      $or: [
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' },
        { invoiceNo: { $regex: '^EDP', $options: 'i' } }
      ]
    },
    {
      $set: {
        companyEntity: 'Elite Digital Print',
        department: 'digital_print'
      }
    }
  );

  console.log(`✅ Updated ${result.modifiedCount} invoices in '${name}'.`);
  await client.close();
}

async function run() {
  await fixInvoices('Live Production (elite_edition)', liveUri);
  await fixInvoices('Local Dev (elite_edition_local)', localDevUri);
  console.log("\n🎉 Legacy invoices updated successfully on both Live & Local databases!");
}

run();
