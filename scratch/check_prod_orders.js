const path = require('path');
require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const prodUrl = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

const SaleOrderSchema = new mongoose.Schema({}, { strict: false });
const SaleOrder = mongoose.model('SaleOrder', SaleOrderSchema, 'sale_orders');

async function check() {
  await mongoose.connect(prodUrl);
  console.log("Connected to production cluster.");
  
  const count = await SaleOrder.countDocuments();
  console.log("Total SaleOrders count in production:", count);
  
  const sample = await SaleOrder.find().sort({ orderDate: -1 }).limit(10).lean();
  console.log("Most recent 10 order dates in production:");
  sample.forEach(s => {
    console.log(`ID: ${s._id}, Date: ${s.orderDate}, status: ${s.saleOrderStatus}`);
  });
}

check()
  .then(() => mongoose.connection.close())
  .catch((err) => {
    console.error(err);
    mongoose.connection.close();
  });
