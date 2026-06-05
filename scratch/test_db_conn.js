require('../src/polyfills/crypto');
const db = require('../src/db/models');

db.mongoose.connection.on('connected', async () => {
  console.log('✅ Connected successfully!');
  try {
    const orders = await db.SaleOrder.find({ itemSKUCode: /301/ }).limit(5).lean();
    console.log(`Found ${orders.length} orders matching 301:`);
    orders.forEach((o, idx) => {
      console.log(`[${idx + 1}] SKU: ${o.itemSKUCode} | Name: ${o.itemTypeName} | Brand: ${o.itemTypeBrand} | MRP: ${o.mrp} | Color: ${o.itemTypeColor} | Size: ${o.itemTypeSize} | Total Price: ${o.totalPrice}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error fetching orders:', err);
    process.exit(1);
  }
});
