const db = require('./src/db/models');

async function checkInventory() {
  try {
    const inv = await db.Inventory.find({
      $or: [
        { skuCode: /273/i },
        { skuCode: /SNGRKASS/i },
        { skuCode: /ANUKKASS/i }
      ]
    }).lean();

    console.log('--- DB INVENTORY (store_inventory) ---');
    console.log(JSON.stringify(inv, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkInventory();
