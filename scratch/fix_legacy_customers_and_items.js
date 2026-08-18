const { MongoClient } = require('mongodb');

const liveUri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const localDevUri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function fixCustomersAndItems(name, uri) {
  console.log(`\n🔧 Fixing legacy customers & items for database '${name}'...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // 1. Set companyEntity = 'Elite Digital Print' on all existing billingcustomers
  const custRes = await db.collection('billingcustomers').updateMany(
    {
      $or: [
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' }
      ]
    },
    {
      $set: {
        companyEntity: 'Elite Digital Print',
        state: 'Gujarat',
        stateCode: '24'
      }
    }
  );
  console.log(`  └─ Updated ${custRes.modifiedCount} billingcustomers in '${name}'.`);

  // 2. Set companyEntity = 'Elite Digital Print' on all existing billingitems
  const itemRes = await db.collection('billingitems').updateMany(
    {
      $or: [
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' }
      ]
    },
    {
      $set: {
        companyEntity: 'Elite Digital Print',
        taxRate: 5,
        unit: 'Meters'
      }
    }
  );
  console.log(`  └─ Updated ${itemRes.modifiedCount} billingitems in '${name}'.`);

  // 3. Extract unique party names from jobCards & fabricChallans and populate missing customers
  const jobParties = await db.collection('jobCards').distinct('party');
  const challanParties = await db.collection('fabricChallans').distinct('partyName');
  
  const allParties = [...new Set([...jobParties, ...challanParties])].map(p => (p || '').trim()).filter(Boolean);
  
  let createdPartiesCount = 0;
  for (const partyName of allParties) {
    if (!partyName || partyName.length < 2) continue;
    const existing = await db.collection('billingcustomers').findOne({
      $or: [
        { name: { $regex: `^${partyName}$`, $options: 'i' } },
        { businessName: { $regex: `^${partyName}$`, $options: 'i' } }
      ]
    });

    if (!existing) {
      await db.collection('billingcustomers').insertOne({
        name: partyName,
        businessName: partyName,
        companyEntity: 'Elite Digital Print',
        phone: '',
        email: '',
        gstin: '',
        billingAddress: 'Surat, Gujarat',
        shippingAddress: 'Surat, Gujarat',
        state: 'Gujarat',
        stateCode: '24',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      createdPartiesCount++;
    }
  }
  console.log(`  └─ Auto-populated ${createdPartiesCount} missing party customer profiles in '${name}'.`);

  // 4. Ensure standard billing items catalog for Elite Digital Prints exists
  const standardItems = [
    { itemName: 'DIGITAL PRINT JOB WORK 36"', hsnCode: '998821', unitPrice: 21, unit: 'Meters', taxRate: 5, companyEntity: 'Elite Digital Print' },
    { itemName: 'DIGITAL PRINT JOB WORK 44"', hsnCode: '998821', unitPrice: 23, unit: 'Meters', taxRate: 5, companyEntity: 'Elite Digital Print' },
    { itemName: 'DIGITAL PRINT JOB WORK 58"', hsnCode: '998821', unitPrice: 25, unit: 'Meters', taxRate: 5, companyEntity: 'Elite Digital Print' },
    { itemName: 'GARMENT STITCHING JOB WORK', hsnCode: '6204', unitPrice: 150, unit: 'Pcs', taxRate: 5, companyEntity: 'Elite Digital Print' }
  ];

  let createdItemsCount = 0;
  for (const stdItem of standardItems) {
    const existing = await db.collection('billingitems').findOne({
      itemName: { $regex: `^${stdItem.itemName}$`, $options: 'i' }
    });
    if (!existing) {
      await db.collection('billingitems').insertOne({
        ...stdItem,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      createdItemsCount++;
    }
  }
  console.log(`  └─ Ensured ${createdItemsCount} standard billing items in '${name}'.`);

  await client.close();
}

async function run() {
  await fixCustomersAndItems('Live Production (elite_edition)', liveUri);
  await fixCustomersAndItems('Local Dev (elite_edition_local)', localDevUri);
  console.log("\n🎉 All customers, parties & billing items updated & restored on both Live & Local databases!");
}

run();
