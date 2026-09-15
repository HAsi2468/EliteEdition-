global.crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkIds() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const db = mongoose.connection.db;
    const col = db.collection('fabricTransactions');

    const ids = [
      new mongoose.Types.ObjectId("6a9936f1bf0828897802f23f"),
      new mongoose.Types.ObjectId("6a9937c9bf0828897802f2df"),
      new mongoose.Types.ObjectId("6a9942b7bf0828897802f750"),
      new mongoose.Types.ObjectId("6a9945a4bf0828897802f7f8")
    ];

    const docs = await col.find({ _id: { $in: ids } }).toArray();

    console.log('=== EXACT CHALLAN DOCUMENTS LINKED IN INVOICES ===');
    docs.forEach(d => {
      console.log(JSON.stringify({
        _id: d._id,
        challanNo: d.challanNo,
        status: d.status,
        invoiceNo: d.invoiceNo,
        invoiceId: d.invoiceId
      }, null, 2));
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkIds();
