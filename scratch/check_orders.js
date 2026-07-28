
const path = require('path');
require('../src/polyfills/crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/db/models');

async function check() {
  const count = await db.SaleOrder.countDocuments();
  console.log("Total SaleOrders count:", count);

  const sample = await db.SaleOrder.find().sort({ orderDate: -1 }).limit(10).lean();
  console.log("Most recent 10 order dates:");
  sample.forEach(s => {
    console.log(`ID: ${s._id}, Date: ${s.orderDate}, status: ${s.saleOrderStatus}`);
  });
}

check()
  .then(() => db.mongoose.connection.close())
  .catch((err) => {
    console.error(err);
    db.mongoose.connection.close();
  });
