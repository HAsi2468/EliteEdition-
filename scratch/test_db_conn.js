require('../src/polyfills/crypto');
const db = require('../src/db/models');

db.mongoose.connection.on('connected', async () => {
  console.log('✅ Connected successfully!');
  try {
    const saleOrdersCount = await db.SaleOrder.countDocuments();
    const salesListCount = await db.SalesList.countDocuments();
    const productCount = await db.Product.countDocuments();
    console.log(`db.SaleOrder count: ${saleOrdersCount}`);
    console.log(`db.SalesList count: ${salesListCount}`);
    console.log(`db.Product count: ${productCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Error fetching counts:', err);
    process.exit(1);
  }
});
