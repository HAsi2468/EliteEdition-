const { MongoClient } = require('mongodb');

const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const LOCAL_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function fixManualInvoicesSeq(name, uri) {
  console.log(`\n🔧 Fixing invoiceSeq for all invoices in '${name}'...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const invoices = await db.collection('billinginvoices').find({}).toArray();
  let updatedCount = 0;

  for (const inv of invoices) {
    if (!inv.invoiceNo) continue;
    // Extract numbers from invoiceNo e.g. "EDP/26-27/297" -> 297
    const match = inv.invoiceNo.match(/(\d+)$/);
    if (match) {
      const realSeq = parseInt(match[1], 10);
      if (inv.invoiceSeq !== realSeq) {
        await db.collection('billinginvoices').updateOne(
          { _id: inv._id },
          { $set: { invoiceSeq: realSeq, companyEntity: 'Elite Digital Print' } }
        );
        console.log(`   Updated Inv #${inv.invoiceNo}: invoiceSeq changed from ${inv.invoiceSeq} -> ${realSeq}`);
        updatedCount++;
      }
    }
  }

  console.log(`  └─ Total updated invoiceSeq count in '${name}': ${updatedCount}`);

  // Re-verify highest sequence
  const highestSeqInv = await db.collection('billinginvoices').find({}).sort({ invoiceSeq: -1 }).limit(3).toArray();
  console.log(`\n  📌 Top 3 Highest Invoices in '${name}':`);
  highestSeqInv.forEach(i => console.log(`     - #${i.invoiceNo} (seq: ${i.invoiceSeq}) | Date: ${i.invoiceDate || i.createdAt}`));

  await client.close();
}

async function run() {
  await fixManualInvoicesSeq('Live Production (elite_edition)', LIVE_URI);
  await fixManualInvoicesSeq('Local Dev (elite_edition_local)', LOCAL_URI);
  console.log("\n🎉 All invoice sequence numbers fixed & sorted correctly on both Live & Local databases!");
}

run();
