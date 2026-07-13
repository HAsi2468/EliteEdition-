global.crypto = require('crypto');
const db = require('./src/db/models');

const isJune = (dateStr) => {
  if (!dateStr) return false;
  // If formatted as YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return parts[1] === '06';
  }
  // If formatted as DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    // Check if parts[1] is '06' or '6'
    return parts[1] === '06' || parts[1] === '6';
  }
  return false;
};

async function main() {
  const cards = await db.JobCard.find({});
  console.log(`Total Job Cards in DB: ${cards.length}`);
  
  let juneCount = 0;
  let nonJuneCount = 0;
  const nonJuneSamples = [];
  const juneSamples = [];

  cards.forEach(c => {
    if (isJune(c.date)) {
      juneCount++;
      if (juneSamples.length < 5) juneSamples.push({ jobNo: c.jobNo, date: c.date });
    } else {
      nonJuneCount++;
      if (nonJuneSamples.length < 5) nonJuneSamples.push({ jobNo: c.jobNo, date: c.date });
    }
  });

  console.log(`June Job Cards count: ${juneCount}`);
  console.log(`Non-June Job Cards count: ${nonJuneCount}`);
  console.log('June samples:', juneSamples);
  console.log('Non-June samples:', nonJuneSamples);
  
  await db.mongoose.connection.close();
}

main().catch(console.error);
