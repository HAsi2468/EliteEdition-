require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB Production');
  
  const Inventory = mongoose.model('Inventory', new mongoose.Schema({}, { strict: false, collection: 'inventory' }));
  
  const totalBefore = await Inventory.countDocuments();
  console.log(`Total inventory items before deletion: ${totalBefore}`);
  
  const result = await Inventory.deleteMany({ party: 'Uniware Channel Sync' });
  console.log(`Deleted ${result.deletedCount} Uniware Channel Sync items from live db.Inventory.`);
  
  const totalAfter = await Inventory.countDocuments();
  console.log(`Total inventory items after deletion: ${totalAfter}`);
  
  await mongoose.connection.close();
}

run().catch(console.error);
