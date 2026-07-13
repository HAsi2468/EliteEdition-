require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB Production');
  
  const SaleOrder = mongoose.model(
    'SaleOrder',
    new mongoose.Schema({}, { strict: false, collection: 'sale_orders' })
  );
  
  // Find all orders where reversePickupCreatedDate is present and not null/empty
  const orders = await SaleOrder.find({
    reversePickupCreatedDate: { $ne: null, $exists: true }
  }).lean();
  
  console.log(`Total orders with Reverse Pickup Created Date: ${orders.length}`);
  
  const brandStats = {};
  
  for (const order of orders) {
    // Skip if it's empty string
    if (!order.reversePickupCreatedDate || order.reversePickupCreatedDate.trim() === '') continue;
    
    const brand = order.itemTypeBrand || 'Unknown Brand';
    const reason = order.reversePickupReason || 'No Reason Specified';
    
    if (!brandStats[brand]) {
      brandStats[brand] = {
        totalReturns: 0,
        reasons: {}
      };
    }
    
    brandStats[brand].totalReturns += 1;
    brandStats[brand].reasons[reason] = (brandStats[brand].reasons[reason] || 0) + 1;
  }
  
  console.log('\n======================================================');
  console.log('            BRAND-WISE RETURN REPORT                  ');
  console.log('======================================================');
  
  const sortedBrands = Object.entries(brandStats).sort((a, b) => b[1].totalReturns - a[1].totalReturns);
  
  for (const [brand, data] of sortedBrands) {
    console.log(`\n🔹 Brand: ${brand}`);
    console.log(`   Total Returns: ${data.totalReturns}`);
    console.log('   Reasons Breakdown:');
    for (const [reason, count] of Object.entries(data.reasons)) {
      console.log(`     - ${reason}: ${count}`);
    }
  }
  console.log('======================================================\n');
  
  await mongoose.connection.close();
}

run().catch(console.error);
