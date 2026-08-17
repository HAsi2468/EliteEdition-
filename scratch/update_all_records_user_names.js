require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('============================================');
  console.log('🚀 RUNNING COMPREHENSIVE DB USER NAME ENRICHMENT');
  console.log('============================================');

  const db = mongoose.connection.db;
  const userCol = db.collection('user');
  const jobCardCol = db.collection('jobCards');
  const chatMsgCol = db.collection('chatmessages');
  const fabricChallanCol = db.collection('fabricChallans');
  const invoiceCol = db.collection('billinginvoices');
  const expenseCol = db.collection('expenses');
  const complaintCol = db.collection('complaints');
  const stitchingChallanCol = db.collection('stitching_challans');

  const users = await userCol.find({}).toArray();
  console.log(`Found ${users.length} staff members in database:`);
  users.forEach(u => console.log(` - ${u.name || u.username} (${u.email || u.role}) [ID: ${u._id}]`));

  // Map users by ID and string ID
  const userMap = {};
  users.forEach(u => {
    const sId = String(u._id);
    userMap[sId] = u.name || u.username || 'Staff User';
  });

  const defaultAdminName = 'HASI';
  console.log(`\nDefault primary staff name for untagged records: "${defaultAdminName}"`);

  // 1. Update Job Cards
  const jobCards = await jobCardCol.find({}).toArray();
  let updatedJobCards = 0;
  for (const jc of jobCards) {
    let realCreator = jc.createdBy;
    if (jc.userId && userMap[String(jc.userId)]) {
      realCreator = userMap[String(jc.userId)];
    } else if (!realCreator || ['Admin', 'Operator', 'System', ''].includes(realCreator.trim())) {
      realCreator = defaultAdminName;
    }

    let realEditor = jc.updatedBy || realCreator;
    if (!realEditor || ['Admin', 'Operator', 'System', ''].includes(realEditor.trim())) {
      realEditor = realCreator;
    }

    await jobCardCol.updateOne(
      { _id: jc._id },
      { $set: { createdBy: realCreator, createdByName: realCreator, updatedBy: realEditor, updatedByName: realEditor } }
    );
    updatedJobCards++;
  }
  console.log(`✅ Updated ${updatedJobCards} Job Cards with real creator/editor names.`);

  // 2. Update Delivery / Fabric Challans
  const fabricChallans = await fabricChallanCol.find({}).toArray();
  let updatedChallans = 0;
  for (const fc of fabricChallans) {
    let realCreator = fc.createdBy;
    if (fc.userId && userMap[String(fc.userId)]) {
      realCreator = userMap[String(fc.userId)];
    } else if (!realCreator || ['Admin', 'Operator', 'System', ''].includes(realCreator.trim())) {
      realCreator = defaultAdminName;
    }

    await fabricChallanCol.updateOne(
      { _id: fc._id },
      { $set: { createdBy: realCreator, createdByName: realCreator } }
    );
    updatedChallans++;
  }
  console.log(`✅ Updated ${updatedChallans} Fabric Challans with real staff names.`);

  // 3. Update Tax Invoices
  const invoices = await invoiceCol.find({}).toArray();
  let updatedInvoices = 0;
  for (const inv of invoices) {
    let realCreator = inv.createdBy;
    if (inv.userId && userMap[String(inv.userId)]) {
      realCreator = userMap[String(inv.userId)];
    } else if (!realCreator || ['Admin', 'Operator', 'System', ''].includes(realCreator.trim())) {
      realCreator = defaultAdminName;
    }

    await invoiceCol.updateOne(
      { _id: inv._id },
      { $set: { createdBy: realCreator, createdByName: realCreator } }
    );
    updatedInvoices++;
  }
  console.log(`✅ Updated ${updatedInvoices} Tax Invoices with real staff names.`);

  // 4. Update Chat Messages containing generic "by Admin" or "by Operator"
  const chatMsgs = await chatMsgCol.find({}).toArray();
  let updatedChatMsgs = 0;
  for (const msg of chatMsgs) {
    let senderName = defaultAdminName;
    if (msg.senderId && userMap[String(msg.senderId)]) {
      senderName = userMap[String(msg.senderId)];
    }

    if (msg.content && /by \*{0,2}(Admin|Operator|System Bot)\*{0,2}\.?/i.test(msg.content)) {
      const newContent = msg.content.replace(/by \*{0,2}(Admin|Operator|System Bot)\*{0,2}\.?/gi, `by **${senderName}**.`);
      await chatMsgCol.updateOne({ _id: msg._id }, { $set: { content: newContent } });
      updatedChatMsgs++;
    }
  }
  console.log(`✅ Updated ${updatedChatMsgs} Chat Messages with real staff member names.`);

  console.log('\n============================================');
  console.log('✅ COMPREHENSIVE DB USER NAME ENRICHMENT COMPLETE!');
  console.log('============================================');
  process.exit(0);
}

run().catch(err => {
  console.error('Database user enrichment failed:', err);
  process.exit(1);
});
