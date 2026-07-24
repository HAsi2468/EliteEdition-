require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

async function clearChallans(dbUri, label) {
  console.log(`\n--- Clearing Fabric Challans for ${label} ---`);
  await mongoose.connect(dbUri);
  
  const deletedChallans = await FabricChallan.deleteMany({});
  console.log(`Deleted ${deletedChallans.deletedCount} FabricChallan document(s).`);

  const deletedTx = await FabricTransaction.deleteMany({
    $or: [
      { challanNo: /^EDP-/ },
      { notes: /Auto: EDP-/ }
    ]
  });
  console.log(`Deleted ${deletedTx.deletedCount} linked EDP- Outward FabricTransaction(s).`);

  const last = await FabricChallan.findOne({}, 'challanNo').sort({ challanNo: -1 });
  const nextNo = last && last.challanNo ? last.challanNo + 1 : 1;
  console.log(`✅ Next Challan Number for ${label} will start at: ${nextNo}`);

  await mongoose.connection.close();
}

async function main() {
  const localUri = config.mongoose.url;
  const prodUri = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

  await clearChallans(localUri, 'Local Database');
  await clearChallans(prodUri, 'Production Database');

  console.log('\n🎉 ALL CHALLAN DATA CLEARED FROM EVERYWHERE! NEW CHALLAN NO WILL START AT 1.');
}

main().catch(console.error);
