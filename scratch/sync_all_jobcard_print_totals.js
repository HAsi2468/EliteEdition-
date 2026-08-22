const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = require('../src/config/config');

async function syncAllJobCards() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;
    const JobCardCol = db.collection('jobCards');
    const JobPrintLogCol = db.collection('jobPrintLogs');

    const cards = await JobCardCol.find({}).toArray();
    console.log(`Found ${cards.length} Job Cards to check & sync.`);

    let updatedCount = 0;

    for (const card of cards) {
      const logs = await JobPrintLogCol.find({
        $or: [
          { jobCardId: card._id },
          { jobNo: card.jobNo }
        ]
      }).sort({ date: -1, createdAt: -1 }).toArray();

      if (logs.length > 0) {
        const totalPrintedMtr = logs.reduce((sum, log) => sum + (Number(log.meters) || 0), 0);
        const targetStr = card.totalMtr || card.consumption || '0';
        const targetMatch = String(targetStr).match(/[\d.]+/);
        const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

        const latestLog = logs[0];
        let printDateStr = card.printDate || '';
        if (latestLog.date) {
          const dt = new Date(latestLog.date);
          if (!isNaN(dt.getTime())) {
            const yr = dt.getFullYear();
            const mo = String(dt.getMonth() + 1).padStart(2, '0');
            const dy = String(dt.getDate()).padStart(2, '0');
            printDateStr = `${yr}-${mo}-${dy}`;
          }
        }

        let printStatusStr = card.printStatus || 'Printing Pending';
        if (totalPrintedMtr > 0) {
          if (targetMtr > 0 && totalPrintedMtr >= targetMtr) {
            printStatusStr = 'Printing Done';
          } else {
            printStatusStr = 'Printing Pending';
          }
        }

        const updateObj = {
          printMtr: `${totalPrintedMtr.toFixed(2)} mtr`,
          printStatus: printStatusStr
        };
        if (printDateStr) updateObj.printDate = printDateStr;
        if (latestLog.operatorName) updateObj.operatorName = latestLog.operatorName;
        if (latestLog.machineName) updateObj.machineName = latestLog.machineName;

        await JobCardCol.updateOne({ _id: card._id }, { $set: updateObj });
        updatedCount++;
      }
    }

    console.log(`\n✅ Backfill Migration Complete! Synced printing details for ${updatedCount} Job Cards.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

syncAllJobCards();
