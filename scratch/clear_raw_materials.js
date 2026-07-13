require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB Production');
  
  const RawMaterialTransaction = mongoose.model(
    'RawMaterialTransaction',
    new mongoose.Schema({}, { strict: false, collection: 'rawMaterialTransactions' })
  );
  
  const totalBefore = await RawMaterialTransaction.countDocuments();
  console.log(`Total raw material transactions before deletion: ${totalBefore}`);
  
  const result = await RawMaterialTransaction.deleteMany({});
  console.log(`Deleted ${result.deletedCount} raw material transactions from live db.`);
  
  const totalAfter = await RawMaterialTransaction.countDocuments();
  console.log(`Total raw material transactions after deletion: ${totalAfter}`);
  
  await mongoose.connection.close();
}

run().catch(console.error);
