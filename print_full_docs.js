global.crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

async function printFullDocs() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const targets = ['EDP-903', 'EDP-904', 'EDP-905', 'EDP-906'];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = db.collection(colName);
      
      const docs = await col.find({
        $or: [
          { challanNo: { $in: targets } },
          { deliveryChallanNo: { $in: targets } },
          { ourChallanNo: { $in: targets } },
          { 'linkedChallanNos': { $elemMatch: { $in: targets } } }
        ]
      }).toArray();

      if (docs.length > 0) {
        console.log(`\n====================================================`);
        console.log(`COLLECTION: [${colName}] (${docs.length} matches)`);
        console.log(`====================================================`);
        docs.forEach(d => {
          console.log(`\nDoc ID: ${d._id} | challanNo: ${d.challanNo || d.ourChallanNo} | status: ${d.status} | invoiceNo: ${d.invoiceNo}`);
          console.log(JSON.stringify(d, null, 2));
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

printFullDocs();
