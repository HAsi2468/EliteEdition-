require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB Production');
  
  const InfrastructureBill = mongoose.model(
    'InfrastructureBill',
    new mongoose.Schema({
      month: String,
      awsAmount: Number,
      mongoDbAmount: Number,
      totalAmount: Number,
      notes: String
    }, { strict: false, collection: 'infrastructureBills' })
  );
  
  // Update June 2026 billing record
  const usdRate = 83.5; // conversion rate
  const mongoDbUsd = 7.13;
  const mongoDbInr = Math.round(mongoDbUsd * usdRate * 100) / 100; // Rs. 595.36
  const awsAmount = 2169.78;
  const totalAmount = awsAmount + mongoDbInr;

  const result = await InfrastructureBill.updateOne(
    { month: 'June 2026' },
    {
      $set: {
        mongoDbAmount: mongoDbInr,
        totalAmount: totalAmount,
        notes: `Initial billing from invoice uploaded on July 2, 2026. MongoDB: $7.13 USD (converted to INR at ${usdRate}).`
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`Successfully updated June 2026 billing record. MongoDB amount: Rs. ${mongoDbInr}, Total: Rs. ${totalAmount}`);
  } else {
    console.log('Billing record not found or already up to date.');
  }
  
  await mongoose.connection.close();
}

run().catch(console.error);
