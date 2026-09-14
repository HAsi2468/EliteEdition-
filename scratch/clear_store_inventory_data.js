const db = require('../src/db/models');

async function clearStoreInventoryData() {
  try {
    console.log('--- CLEARING STORE INVENTORY DATA (Overview, Inward, Outward) ---');
    
    let retries = 0;
    while (db.mongoose.connection.readyState !== 1 && retries < 10) {
      await new Promise(res => setTimeout(res, 500));
      retries++;
    }

    const inventoryCountBefore = await db.Inventory.countDocuments();
    const stockOutCountBefore = await db.StockOut.countDocuments();

    console.log(`Current Inventory records: ${inventoryCountBefore}`);
    console.log(`Current StockOut records: ${stockOutCountBefore}`);

    const inventoryResult = await db.Inventory.deleteMany({});
    const stockOutResult = await db.StockOut.deleteMany({});

    console.log('\n✅ STORE INVENTORY DATA CLEARED SUCCESSFULLY:');
    console.log(`- Deleted ${inventoryResult.deletedCount} items from Inventory.`);
    console.log(`- Deleted ${stockOutResult.deletedCount} items from StockOut.`);
    
    const productCatalogCount = await db.InventoryProduct.countDocuments();
    console.log(`\nℹ️ Product Catalog preserved: ${productCatalogCount} items intact.`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing store inventory data:', err);
    process.exit(1);
  }
}

clearStoreInventoryData();
