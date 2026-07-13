require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(mongoUrl);
  
  const SaleOrder = mongoose.model(
    'SaleOrder',
    new mongoose.Schema({}, { strict: false, collection: 'sale_orders' })
  );
  
  const sampleReturnDateDoc = await SaleOrder.findOne({
    returnDate: { $ne: null, $exists: true, $ne: "" }
  }).lean();
  
  if (sampleReturnDateDoc) {
    console.log('Sample returnDate format:', JSON.stringify(sampleReturnDateDoc.returnDate));
  } else {
    console.log('No returnDate doc found.');
  }

  await mongoose.connection.close();
}

run().catch(console.error);
