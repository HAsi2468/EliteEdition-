global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

function normalizeDateStr(dtStr) {
  if (!dtStr || typeof dtStr !== 'string' || !dtStr.trim()) return '';
  const s = dtStr.trim();
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const day   = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year  = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year  = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day   = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
}

async function fixDates() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to DB');

  const cards = await db.JobCard.find({}).lean();
  console.log('Total JobCard count:', cards.length);

  let updatedCount = 0;
  for (const c of cards) {
    const newDate = normalizeDateStr(c.date);
    const newPrintDate = normalizeDateStr(c.printDate);
    const newFusingDate = normalizeDateStr(c.fusingDate);
    const newDeliveryDate = normalizeDateStr(c.deliveryDate);

    if (newDate !== c.date || newPrintDate !== c.printDate || newFusingDate !== c.fusingDate || newDeliveryDate !== c.deliveryDate) {
      await db.JobCard.updateOne(
        { _id: c._id },
        { $set: { date: newDate, printDate: newPrintDate, fusingDate: newFusingDate, deliveryDate: newDeliveryDate } }
      );
      updatedCount++;
    }
  }
  console.log('Production JobCards updated with normalized ISO dates:', updatedCount);
  process.exit(0);
}

fixDates();
