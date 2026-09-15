global.crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

async function searchAllCollections() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb+srv://harshitsidapara2468:Harshit2468@cluster0.n1p6h.mongodb.net/elite_edition?retryWrites=true&w=majority');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('=== SEARCHING ALL MONGODB COLLECTIONS FOR EDP-903 & EDP-905 ===');

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = db.collection(colName);
      const docs = await col.find({
        $or: [
          { challanNo: { $regex: 'EDP-903|EDP-905', $options: 'i' } },
          { deliveryChallanNo: { $regex: 'EDP-903|EDP-905', $options: 'i' } },
          { ourChallanNo: { $regex: 'EDP-903|EDP-905', $options: 'i' } }
        ]
      }).toArray();

      if (docs.length > 0) {
        console.log(`\n📌 Found ${docs.length} document(s) in Collection: [${colName}]`);
        docs.forEach(d => {
          console.log(JSON.stringify({
            _id: d._id,
            challanNo: d.challanNo || d.deliveryChallanNo || d.ourChallanNo,
            status: d.status,
            invoiceId: d.invoiceId,
            invoiceNo: d.invoiceNo,
            createdAt: d.createdAt || d.created_at
          }, null, 2));
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

searchAllCollections();
