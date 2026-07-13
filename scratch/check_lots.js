require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');
  
  const Inventory = mongoose.model('Inventory', new mongoose.Schema({}, { strict: false, collection: 'inventory' }));
  
  const total = await Inventory.countDocuments();
  console.log(`Total inventory items: ${total}`);
  
  // Find distinct party values
  const parties = await Inventory.distinct('party');
  console.log('Distinct parties in inventory:', parties);
  
  // Print some items that look like they could be Uniware items
  const uniItems = await Inventory.find({ 
    $or: [
      { party: /uniware/i },
      { party: 'Uniware Channel Sync' },
      { party: null },
      { party: { $exists: false } }
    ]
  }).limit(20);
  
  console.log(`Found ${uniItems.length} matching potential Uniware items in inventory:`);
  uniItems.forEach(item => {
    console.log(`ID: ${item._id}, SKU: ${item.skuCode}, Name: ${item.itemName}, Party: ${item.party}, Qty: ${item.qty}`);
  });
  
  await mongoose.connection.close();
}

run().catch(console.error);
