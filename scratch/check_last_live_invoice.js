const { MongoClient } = require('mongodb');

const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function checkLastLiveInvoice() {
  console.log("🔍 Checking highest invoiceSeq on Live Production Database...");
  const client = new MongoClient(LIVE_URI);
  try {
    await client.connect();
    const db = client.db('elite_edition');
    
    // Find highest invoiceSeq
    const highestSeqInv = await db.collection('billinginvoices').find({}).sort({ invoiceSeq: -1 }).limit(5).toArray();
    console.log(`Highest invoiceSeq count: ${highestSeqInv.length}`);
    highestSeqInv.forEach(inv => {
      console.log(`  - Inv #${inv.invoiceNo} | invoiceSeq: ${inv.invoiceSeq} | CompanyEntity: '${inv.companyEntity}' | Date: ${inv.invoiceDate || inv.createdAt}`);
    });

    const maxSeq = highestSeqInv.length > 0 ? highestSeqInv[0].invoiceSeq : 295;
    const nextSeq = maxSeq + 1;
    console.log(`\n=> Last Invoice No: '${highestSeqInv[0]?.invoiceNo}' (seq: ${maxSeq})`);
    console.log(`=> Next Invoice No will be: 'EDP/26-27/${nextSeq}'`);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.close();
  }
}

checkLastLiveInvoice();
