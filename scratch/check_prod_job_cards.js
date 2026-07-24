const path = require('path');
require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const prodUrl = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

const JobCardSchema = new mongoose.Schema({}, { strict: false });
const JobCard = mongoose.model('JobCard', JobCardSchema, 'jobCards');

async function check() {
  await mongoose.connect(prodUrl);
  const card = await JobCard.findOne({ jobNo: 'JOB-2159' }).lean();
  console.log("JOB-2159:", JSON.stringify(card, null, 2));
}

check()
  .then(() => mongoose.connection.close())
  .catch((err) => {
    console.error(err);
    mongoose.connection.close();
  });
