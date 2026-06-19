const mongoose = require('mongoose');
const config = require('./src/config/config');
const { SalesList } = require('./src/db/models');

mongoose.connect(config.mongoose.url).then(async () => {
  console.log('Connected to MongoDB');
  const count = await SalesList.countDocuments();
  console.log('Total SalesList documents:', count);
  
  const recentSales = await SalesList.find().sort({ orderDate: -1 }).limit(5);
  console.log('Recent 5 sales orderDates:');
  recentSales.forEach(s => {
    console.log(s.orderDate, ' | ', s.itemSKUCode);
  });
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);
  
  const countYesterday = await SalesList.countDocuments({
    orderDate: { $gte: yesterday, $lte: endOfYesterday }
  });
  console.log(`Sales yesterday (${yesterday.toISOString().split('T')[0]}):`, countYesterday);
  
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
