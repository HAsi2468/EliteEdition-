const mongoose = require('mongoose');
const db = require('../src/db/models');

async function backfillComplaints() {
  try {
    console.log('🔄 Backfilling companyEntity on Complaint documents...');
    const result = await db.Complaint.updateMany(
      { $or: [{ companyEntity: { $exists: false } }, { companyEntity: null }, { companyEntity: '' }] },
      { $set: { companyEntity: 'Elite Digital Print' } }
    );
    console.log('✅ Backfill complete for complaints:', result);
  } catch (err) {
    console.error('❌ Error backfilling complaints:', err.message);
  } finally {
    process.exit(0);
  }
}

backfillComplaints();
