global.crypto = require('crypto');
const db = require('./src/db/models');

async function clearStoreInventoryData() {
  try {
    console.log('--- CLEARING STORE INVENTORY DATA (Overview, Inward, Outward) ---');
    
    // Wait for DB connection if needed
    let retries = 0;
    while (db.mongoose.connection.readyState !== 1 && retries < 10) {
      await new Promise(res => setTimeout(res, 500));
      retries++;
    }

    const inventoryCountBefore = await db.Inventory.countDocuments();
    const stockOutCountBefore = await db.StockOut.countDocuments();

    console.log(`Current Inventory records (Stock Overview / Inward): ${inventoryCountBefore}`);
    console.log(`Current StockOut records (Outward): ${stockOutCountBefore}`);

    const inventoryResult = await db.Inventory.deleteMany({});
    const stockOutResult = await db.StockOut.deleteMany({});

    console.log('\n✅ DELETION COMPLETED SUCCESSFULLY:');
    console.log(`- Deleted ${inventoryResult.deletedCount} items from Inventory (Stock Overview / Inward).`);
    console.log(`- Deleted ${stockOutResult.deletedCount} items from StockOut (Outward).`);
    
    const productCatalogCount = await db.InventoryProduct.countDocuments();
    console.log(`\nℹ️ Product Catalog (Master Products) preserved: ${productCatalogCount} items intact.`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing store inventory data:', err);
    process.exit(1);
  }
}

clearStoreInventoryData();
