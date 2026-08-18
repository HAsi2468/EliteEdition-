const { MongoClient } = require('mongodb');

// Live Production MongoDB URI
const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectCustomersAndItems() {
  console.log("🔍 Inspecting Live Customers & Items Collections...");
  const client = new MongoClient(LIVE_URI);

  try {
    await client.connect();
    const db = client.db('elite_edition');

    // 1. billingcustomers
    const billingCustomers = await db.collection('billingcustomers').find({}).toArray();
    console.log(`\n👥 billingcustomers Count: ${billingCustomers.length}`);
    billingCustomers.forEach((c, i) => {
      console.log(`  [${i+1}] Name: '${c.name}' | BusinessName: '${c.businessName}' | CompanyEntity: '${c.companyEntity}' | GSTIN: '${c.gstin}'`);
    });

    // 2. partys
    const partys = await db.collection('partys').find({}).toArray();
    console.log(`\n🏢 partys Count: ${partys.length}`);
    partys.forEach((p, i) => {
      console.log(`  [${i+1}] Name: '${p.name}' | BusinessName: '${p.businessName}' | CompanyEntity: '${p.companyEntity}'`);
    });

    // 3. billingitems
    const billingItems = await db.collection('billingitems').find({}).toArray();
    console.log(`\n🏷️ billingitems Count: ${billingItems.length}`);
    billingItems.forEach((it, i) => {
      console.log(`  [${i+1}] ItemName: '${it.itemName}' | HSN: '${it.hsnCode}' | Price: ${it.unitPrice} | CompanyEntity: '${it.companyEntity}'`);
    });

    // 4. products
    const products = await db.collection('products').find({}).toArray();
    console.log(`\n📦 products Count: ${products.length}`);
    if (products.length > 0) {
      console.log(`   Sample products:`, products.slice(0, 3).map(p => ({ title: p.title, name: p.name, category: p.category })));
    }

    // 5. Unique Parties from Job Cards & Challans
    const jobParties = await db.collection('jobCards').distinct('party');
    console.log(`\n📋 Unique Parties in JobCards (${jobParties.length}):`, jobParties.slice(0, 10));

    const challanParties = await db.collection('fabricChallans').distinct('partyName');
    console.log(`📦 Unique Parties in FabricChallans (${challanParties.length}):`, challanParties.slice(0, 10));

  } catch (err) {
    console.error("❌ Error during inspection:", err.message);
  } finally {
    await client.close();
  }
}

inspectCustomersAndItems();
