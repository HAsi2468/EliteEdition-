require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('--- SMART MAPPING JOB CARD CREATORS FROM DESIGNER/OPERATOR ---');

  const db = mongoose.connection.db;
  const jobCardCol = db.collection('jobCards');
  const userCol = db.collection('user');

  const users = await userCol.find({}).toArray();
  const userNameMap = {};
  users.forEach(u => {
    const n = (u.name || u.username || '').toUpperCase();
    userNameMap[n] = u.name || u.username;
  });

  console.log('User Map:', userNameMap);

  const jcs = await jobCardCol.find({}).toArray();
  let updatedCount = 0;

  for (const jc of jcs) {
    let rawStaff = (jc.designer || jc.colourMatching || jc.operatorName || '').trim();
    let mappedName = '';

    if (rawStaff) {
      const uKey = rawStaff.toUpperCase();
      if (userNameMap[uKey]) {
        mappedName = userNameMap[uKey];
      } else if (uKey === 'DEVANSU') {
        mappedName = 'Devansu';
      } else if (uKey === 'RUSHABH') {
        mappedName = 'Rushabh Patel';
      } else if (uKey === 'JAY') {
        mappedName = 'Jay Patel';
      } else if (uKey === 'RAM') {
        mappedName = 'Ram Patel';
      } else if (uKey === 'DEV') {
        mappedName = 'Dev Patel';
      } else if (uKey === 'DHRUV') {
        mappedName = 'Dhruv Patel';
      } else if (uKey === 'HARSHIL') {
        mappedName = 'Harshil Sidapara';
      } else if (uKey === 'KAUSHIK' || uKey === 'KAUSHIK SIR') {
        mappedName = 'Kaushik Nakum';
      } else if (uKey === 'RC') {
        mappedName = 'RC';
      } else if (uKey === 'OE' || uKey === 'OFAB') {
        mappedName = 'Elite Edition';
      } else {
        mappedName = rawStaff;
      }
    }

    if (!mappedName) {
      mappedName = 'Parth Asodariya';
    }

    await jobCardCol.updateOne(
      { _id: jc._id },
      { 
        $set: { 
          createdBy: mappedName, 
          createdByName: mappedName, 
          updatedBy: mappedName, 
          updatedByName: mappedName 
        } 
      }
    );
    updatedCount++;
  }

  console.log(`✅ Smart mapped ${updatedCount} Job Cards to their exact staff creators!`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
