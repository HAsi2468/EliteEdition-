/**
 * One-time and maintenance migration script to backfill `lotNo` on Job Cards
 * from linked Fabric Challans and Fabric Transactions.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function backfillLotNumbers() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUrl) {
    console.error('MONGODB_URL not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const JobCard = mongoose.model('JobCard', new mongoose.Schema({}, { strict: false }), 'jobCards');
  const FabricChallan = mongoose.model('FabricChallan', new mongoose.Schema({}, { strict: false }), 'fabricChallans');

  const cardsWithoutLot = await JobCard.find({
    $or: [{ lotNo: { $exists: false } }, { lotNo: '' }, { lotNo: null }, { lotNo: '—' }]
  }).lean();

  console.log(`Found ${cardsWithoutLot.length} Job Cards without a lot number.`);
  let updatedCount = 0;

  for (const card of cardsWithoutLot) {
    if (!card.jobNo) continue;

    const cleanNo = String(card.jobNo).replace(/^#?JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
    const digits = cleanNo.match(/\d+/)?.[0];
    const or = [
      { jobNo: String(card.jobNo).trim() },
      { jobNo: new RegExp('\\b' + cleanNo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '\\b', 'i') }
    ];
    if (digits) {
      or.push({ jobNo: new RegExp('\\b' + digits + '\\b', 'i') });
    }

    const challans = await FabricChallan.find({ $or: or }).lean();
    const lotSet = new Set();

    for (const ch of challans) {
      if (ch.lotNo) {
        String(ch.lotNo).split(/[,/&]+/).map(s => s.trim()).filter(Boolean).forEach(l => {
          if (l && l !== '—' && l !== 'N/A' && l !== 'null' && l !== 'undefined') lotSet.add(l);
        });
      }
      if (Array.isArray(ch.tpDetails)) {
        for (const tp of ch.tpDetails) {
          if (tp.lotNo) {
            String(tp.lotNo).split(/[,/&]+/).map(s => s.trim()).filter(Boolean).forEach(l => {
              if (l && l !== '—' && l !== 'N/A' && l !== 'null' && l !== 'undefined') lotSet.add(l);
            });
          }
        }
      }
    }

    // Check notes if still empty
    if (lotSet.size === 0) {
      const combinedNotes = `${card.note1 || ''} ${card.note2 || ''}`;
      const noteMatch = combinedNotes.match(/Lot\s*#?\s*([A-Za-z0-9\-_,\s]+)/i);
      if (noteMatch && noteMatch[1] && noteMatch[1].trim() !== 'N/A') {
        String(noteMatch[1]).split(/[,/&]+/).map(s => s.trim()).filter(Boolean).forEach(l => {
          if (l && l !== '—' && l !== 'N/A') lotSet.add(l);
        });
      }
    }

    if (lotSet.size > 0) {
      const resolvedLotNo = Array.from(lotSet).join(', ');
      await JobCard.updateOne({ _id: card._id }, { $set: { lotNo: resolvedLotNo } });
      updatedCount++;
    }
  }

  console.log(`✅ Successfully backfilled lot numbers for ${updatedCount} Job Cards.`);
  process.exit(0);
}

backfillLotNumbers().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
