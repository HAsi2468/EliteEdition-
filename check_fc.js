global.crypto = require('crypto');
const db = require('./src/db/models');

async function checkFabricChallans() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const challans = await db.user.db.collection('fabricChallans').find({
      challanNo: { $in: ['EDP-903', 'EDP-904', 'EDP-905', 'EDP-906'] }
    }).toArray();

    console.log('=== FABRIC CHALLANS FOR EDP-903, EDP-904, EDP-905, EDP-906 ===');
    console.log(JSON.stringify(challans.map(c => ({
      _id: c._id,
      challanNo: c.challanNo,
      partyName: c.partyName,
      status: c.status,
      invoiceId: c.invoiceId,
      invoiceNo: c.invoiceNo,
      createdAt: c.createdAt || c.created_date_time
    })), null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkFabricChallans();
