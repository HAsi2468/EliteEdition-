const path = require('path');
require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const prodUrl = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

async function test() {
  await mongoose.connect(prodUrl);
  console.log("Connected to production cluster.");

  const JobCardSchema = new mongoose.Schema({}, { strict: false });
  const JobCard = mongoose.model('JobCard', JobCardSchema, 'jobCards');

  const page = 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const cards = await JobCard.aggregate([
    {
      $addFields: {
        jobNoNum: {
          $convert: {
            input: {
              $let: {
                vars: {
                  matchObj: { $regexFind: { input: "$jobNo", regex: "\\d+" } }
                },
                in: "$$matchObj.match"
              }
            },
            to: "int",
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    { $sort: { jobNoNum: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  console.log("Returned cards count:", cards.length);
  cards.forEach(c => {
    console.log(`JobNo: ${c.jobNo}, designNo: ${c.designNo}, party: ${c.party}, status: ${c.status}, jobNoNum: ${c.jobNoNum}`);
  });
}

test()
  .then(() => mongoose.connection.close())
  .catch((err) => {
    console.error(err);
    mongoose.connection.close();
  });
