const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectInvoices() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const invoices = await db.collection('billinginvoices').find({}).toArray();
  console.log(`Found ${invoices.length} invoices in 'billinginvoices' collection.`);

  const companyEntities = {};
  const departments = {};

  invoices.forEach((inv, i) => {
    const ce = inv.companyEntity || 'UNDEFINED';
    const dep = inv.department || 'UNDEFINED';
    companyEntities[ce] = (companyEntities[ce] || 0) + 1;
    departments[dep] = (departments[dep] || 0) + 1;
    if (i < 5) {
      console.log(`[Invoice #${i+1}] No: ${inv.invoiceNo}, Customer: ${inv.customerName || inv.partyName || inv.customer?.name}, Total: ${inv.grandTotal}, CompanyEntity: ${inv.companyEntity}, Dept: ${inv.department}`);
    }
  });

  console.log("\nCompany Entities breakdown:", companyEntities);
  console.log("Departments breakdown:", departments);

  await client.close();
}

inspectInvoices();
