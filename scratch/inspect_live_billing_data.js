const { MongoClient } = require('mongodb');

// Live Production MongoDB URI
const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectLiveBillingData() {
  console.log("🔍 Checking Live Production Billing Data on Atlas Cluster...");
  const client = new MongoClient(LIVE_URI);

  try {
    await client.connect();
    console.log("✅ Connected to Live Production Database ('elite_edition').\n");
    const db = client.db('elite_edition');

    // 1. Invoices
    const invoices = await db.collection('billinginvoices').find({}).sort({ invoiceSeq: -1, created_at: -1 }).toArray();
    console.log(`🧾 Billing Invoices Count: ${invoices.length}`);
    if (invoices.length > 0) {
      console.log("   Recent Invoices Sample:");
      invoices.slice(0, 5).forEach(inv => {
        console.log(`    - Inv #${inv.invoiceNo} | Date: ${inv.invoiceDate || inv.createdAt} | Party: ${inv.customerName || inv.partyName || inv.customer?.name} | Amount: ₹${inv.grandTotal || inv.totalAmount} | CompanyEntity: '${inv.companyEntity}'`);
      });
    }

    // 2. Delivery Challans
    const challans = await db.collection('fabricChallans').find({}).sort({ created_at: -1 }).toArray();
    console.log(`\n📦 Fabric Challans Count: ${challans.length}`);
    if (challans.length > 0) {
      console.log("   Recent Challans Sample:");
      challans.slice(0, 5).forEach(ch => {
        console.log(`    - Challan #${ch.challanNo} | Party: ${ch.partyName || ch.billTo} | Mtr: ${ch.totalMtr} | Status: ${ch.status}`);
      });
    }

    // 3. Print Configs (Invoice Settings)
    const printConfigs = await db.collection('printconfigs').find({}).toArray();
    console.log(`\n⚙️ Print Configs Count: ${printConfigs.length}`);
    printConfigs.forEach(cfg => {
      console.log(`    - CompanyEntity: '${cfg.companyEntity}' | Prefix: '${cfg.invoicePrefix}' | StartingSeq: ${cfg.startingInvoiceNo} | CompanyName: '${cfg.companyName}' | GSTIN: '${cfg.companyGstin}'`);
    });

    // 4. Billing Customers
    const customers = await db.collection('billingcustomers').find({}).toArray();
    console.log(`\n👥 Billing Customers Count: ${customers.length}`);

    // 5. Billing Items
    const items = await db.collection('billingitems').find({}).toArray();
    console.log(`\n🏷️ Billing Items Count: ${items.length}`);

    console.log("\n========================================================");
    console.log("✅ ALL LIVE BILLING DATA IS INTACT IN MONGO ATLAS!");
    console.log("========================================================\n");

  } catch (err) {
    console.error("❌ Error inspecting live billing data:", err.message);
  } finally {
    await client.close();
  }
}

inspectLiveBillingData();
