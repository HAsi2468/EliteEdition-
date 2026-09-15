global.crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

async function findChallans() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;

    const collections = ['fabricTransactions', 'fabricChallans', 'stitchingChallans', 'rawMaterialTransactions'];

    for (const name of collections) {
      const col = db.collection(name);
      const docs = await col.find({
        challanNo: { $in: ['EDP-903', 'EDP-904', 'EDP-905', 'EDP-906'] }
      }).toArray();

      if (docs.length > 0) {
        console.log(`\nCollection: [${name}] - Found ${docs.length}`);
        docs.forEach(d => {
          console.log(`  _id: ${d._id} (type: ${typeof d._id}) | challanNo: ${d.challanNo} | status: ${d.status} | invoiceNo: ${d.invoiceNo}`);
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

findChallans();
