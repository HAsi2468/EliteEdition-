const path = require('path');
require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const prodUrl = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

const JobCardSchema = new mongoose.Schema({}, { strict: false });
const JobCard = mongoose.model('JobCard', JobCardSchema, 'jobCards');

async function check() {
  await mongoose.connect(prodUrl);
  
  const cards = await JobCard.find().limit(5).lean();
  cards.forEach(c => {
    console.log(`JobNo: ${c.jobNo}, Pcs: "${c.pcs}", Cons: "${c.consumption}", TotalMtr: "${c.totalMtr}", Dupatta: "${c.dupatta}", Cut: "${c.cut}"`);
  });
}

check()
  .then(() => mongoose.connection.close())
  .catch((err) => {
    console.error(err);
    mongoose.connection.close();
  });
