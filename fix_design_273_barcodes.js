const db = require('./src/db/models');

async function fix273() {
  try {
    const products = await db.Product.find({
      $or: [
        { skuCode: /273/i },
        { skuCode: /SNGRKASS/i },
        { skuCode: /ANUKKASS/i }
      ]
    }).lean();

    console.log('--- PRODUCTS MATCHING 273 / SNGRKASS / ANUKKASS ---');
    products.forEach(p => {
      console.log(`ID: ${p._id} | SKU: "${p.skuCode}" | Brand: "${p.brand}" | Size: ${JSON.stringify(p.size)} | Image: ${p.imageUrl}`);
    });

    const invRecords = await db.Inventory.find({
      $or: [
        { skuCode: /273/i },
        { skuCode: /SNGRKASS/i },
        { skuCode: /ANUKKASS/i }
      ]
    }).lean();

    console.log('--- INVENTORY RECORDS MATCHING 273 / SNGRKASS / ANUKKASS ---');
    invRecords.forEach(r => {
      console.log(`ID: ${r._id} | SKU: "${r.skuCode}" | Item: "${r.itemName}" | Size: "${r.size}" | Qty: ${r.qty}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix273();
