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
  
  // Check if June 2026 already exists
  const existing = await InfrastructureBill.findOne({ month: 'June 2026' });
  if (!existing) {
    const bill = new InfrastructureBill({
      month: 'June 2026',
      awsAmount: 2169.78,
      mongoDbAmount: 0.00,
      totalAmount: 2169.78,
      notes: 'Initial billing from invoice uploaded on July 2, 2026.'
    });
    await bill.save();
    console.log('Successfully seeded June 2026 billing record.');
  } else {
    console.log('June 2026 billing record already exists.');
  }
  
  await mongoose.connection.close();
}

run().catch(console.error);
