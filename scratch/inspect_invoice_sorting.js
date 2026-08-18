const { MongoClient } = require('mongodb');

const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectInvoiceSorting() {
  console.log("🔍 Inspecting Live Database Invoices & Sequences...");
  const client = new MongoClient(LIVE_URI);
  try {
    await client.connect();
    const db = client.db('elite_edition');

    const invoices = await db.collection('billinginvoices').find({}).toArray();
    console.log(`Total Billing Invoices on Live: ${invoices.length}`);

    // Sort by invoiceSeq desc
    const sortedBySeq = [...invoices].sort((a, b) => (b.invoiceSeq || 0) - (a.invoiceSeq || 0));
    console.log("\n📌 Top 10 Sorted by invoiceSeq (DESC):");
    sortedBySeq.slice(0, 10).forEach(inv => {
      console.log(`  - Inv #${inv.invoiceNo} (seq: ${inv.invoiceSeq}) | Date: ${inv.invoiceDate || inv.createdAt} | CreatedAt: ${inv.createdAt || inv.created_at}`);
    });

    // Sort by createdAt desc
    const sortedByCreated = [...invoices].sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    console.log("\n📌 Top 10 Sorted by createdAt (DESC):");
    sortedByCreated.slice(0, 10).forEach(inv => {
      console.log(`  - Inv #${inv.invoiceNo} (seq: ${inv.invoiceSeq}) | Date: ${inv.invoiceDate || inv.createdAt} | CreatedAt: ${inv.createdAt || inv.created_at}`);
    });

    // Check 296 and 297 specifically
    const inv296 = invoices.find(i => i.invoiceNo === 'EDP/26-27/296' || i.invoiceSeq === 296);
    const inv297 = invoices.find(i => i.invoiceNo === 'EDP/26-27/297' || i.invoiceSeq === 297);
    const inv225 = invoices.find(i => i.invoiceNo === 'EDP/26-27/225' || i.invoiceSeq === 225);

    console.log("\n🔍 Specific Invoices Inspection:");
    if (inv297) console.log("   297:", { invoiceNo: inv297.invoiceNo, invoiceSeq: inv297.invoiceSeq, createdAt: inv297.createdAt || inv297.created_at, invoiceDate: inv297.invoiceDate });
    if (inv296) console.log("   296:", { invoiceNo: inv296.invoiceNo, invoiceSeq: inv296.invoiceSeq, createdAt: inv296.createdAt || inv296.created_at, invoiceDate: inv296.invoiceDate });
    if (inv225) console.log("   225:", { invoiceNo: inv225.invoiceNo, invoiceSeq: inv225.invoiceSeq, createdAt: inv225.createdAt || inv225.created_at, invoiceDate: inv225.invoiceDate });

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.close();
  }
}

inspectInvoiceSorting();
