require('dotenv').config();
const db = require('../src/db/models');
const RawMaterialTransaction = require('../src/db/models/rawMaterialTransaction.model');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');

async function backfillCompanyEntity() {
  try {
    console.log('🔄 Backfilling companyEntity on RawMaterialTransaction documents...');
    const rawRes = await RawMaterialTransaction.updateMany(
      {
        $or: [
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ]
      },
      { $set: { companyEntity: 'Elite Digital Print' } }
    );
    console.log(`✅ Updated ${rawRes.modifiedCount || 0} RawMaterialTransaction documents to "Elite Digital Print".`);

    console.log('🔄 Backfilling companyEntity on FabricTransaction documents...');
    const fabTxRes = await FabricTransaction.updateMany(
      {
        $or: [
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ]
      },
      { $set: { companyEntity: 'Elite Digital Print' } }
    );
    console.log(`✅ Updated ${fabTxRes.modifiedCount || 0} FabricTransaction documents to "Elite Digital Print".`);

    console.log('🔄 Backfilling companyEntity on FabricChallan documents...');
    const fabChallanRes = await FabricChallan.updateMany(
      {
        $or: [
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ]
      },
      { $set: { companyEntity: 'Elite Digital Print' } }
    );
    console.log(`✅ Updated ${fabChallanRes.modifiedCount || 0} FabricChallan documents to "Elite Digital Print".`);

    console.log('============================================');
    console.log('✅ BACKFILL RAW MATERIALS & FABRIC COMPANY ENTITY COMPLETE!');
    console.log('============================================');
  } catch (err) {
    console.error('❌ Error backfilling companyEntity:', err.message);
  } finally {
    process.exit(0);
  }
}

backfillCompanyEntity();
