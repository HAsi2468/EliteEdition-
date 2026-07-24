require('../src/polyfills/crypto');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const config = require('../src/config/config');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

const parseQualityAndPanna = (qlty) => {
  if (!qlty) return { fabricQuality: '', panna: '' };
  qlty = qlty.trim();
  const match = qlty.match(/(.*?)\s*(58[\"']?|36[\"']?|44[\"']?|48[\"']?|60[\"']?)$/i);
  if (match) {
    const rawPanna = match[2].replace(/['\"]/g, '');
    return {
      fabricQuality: match[1].trim(),
      panna: rawPanna
    };
  }
  return { fabricQuality: qlty.replace(/['\"]/g, '').trim(), panna: '' };
};

async function run() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB:', config.mongoose.url);

  const excelPath = path.join(__dirname, '../../Fabric-2.xlsx');
  console.log('Loading Excel file:', excelPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const sheetsToProcess = [
    { name: 'Sheet3', defaultDate: '2026-05-15' },
    { name: 'JUN-2026', defaultDate: '2026-06-15' },
    { name: 'JULY-2026', defaultDate: '2026-07-15' }
  ];

  // Delete existing FabricTransactions
  const deleteResult = await FabricTransaction.deleteMany({});
  console.log(`Deleted ${deleteResult.deletedCount} existing FabricTransactions from DB.`);

  let inwardCount = 0;
  let outwardCount = 0;

  for (const { name, defaultDate } of sheetsToProcess) {
    const ws = workbook.getWorksheet(name);
    if (!ws) {
      console.log(`Sheet '${name}' not found, skipping.`);
      continue;
    }

    let sheetInward = 0;
    let sheetOutward = 0;

    for (let rIdx = 3; rIdx <= ws.rowCount; rIdx++) {
      const row = ws.getRow(rIdx);
      const vals = row.values.slice(1);
      const lot = vals[0];
      const vendor = vals[1];
      const qltyRaw = vals[2];
      const ch = vals[3];
      const mtr = parseFloat(vals[4]);

      if (lot !== undefined && lot !== null && lot !== '' && qltyRaw && !isNaN(mtr) && mtr > 0) {
        const lotNo = typeof lot === 'number' ? lot : parseInt(lot);
        const { fabricQuality, panna } = parseQualityAndPanna(String(qltyRaw));
        const vendorName = String(vendor || '').trim();
        const challanNo = String(ch !== undefined && ch !== null ? ch : '').trim();

        // 1. Create Inward record
        const inwardTx = new FabricTransaction({
          type: 'INWARD',
          lotNo: lotNo,
          vendorName: vendorName,
          fabricQuality: fabricQuality,
          panna: panna,
          challanNo: challanNo,
          qty: mtr,
          date: new Date(defaultDate),
          notes: `Imported from Fabric-2.xlsx (${name})`
        });

        await inwardTx.save();
        sheetInward++;

        // 2. Create Outward records (up to 10 pairs of Qty, Job/Challan)
        for (let p = 0; p < 10; p++) {
          const qCol = 5 + p * 2;
          const jCol = 6 + p * 2;
          const oQty = parseFloat(vals[qCol]);
          const oJob = vals[jCol];

          if (!isNaN(oQty) && oQty > 0) {
            let jobNo = '-';
            let challanNoOut = '';
            let notes = `Imported from Fabric-2.xlsx (${name})`;

            if (oJob !== undefined && oJob !== null && oJob !== '') {
              if (typeof oJob === 'number') {
                jobNo = String(oJob);
                challanNoOut = String(oJob);
              } else {
                const sJob = String(oJob).trim();
                if (/^\d+$/.test(sJob)) {
                  jobNo = sJob;
                  challanNoOut = sJob;
                } else {
                  notes = sJob;
                }
              }
            }

            const outwardTx = new FabricTransaction({
              type: 'OUTWARD',
              lotNo: lotNo,
              fabricQuality: fabricQuality,
              panna: panna,
              qty: oQty,
              jobNo: jobNo,
              challanNo: challanNoOut,
              notes: notes,
              date: new Date(defaultDate),
              partyName: '-'
            });

            await outwardTx.save();
            sheetOutward++;
          }
        }
      }
    }

    console.log(`Sheet '${name}': Imported ${sheetInward} INWARD, ${sheetOutward} OUTWARD`);
    inwardCount += sheetInward;
    outwardCount += sheetOutward;
  }

  console.log(`\n✅ SUCCESSFULLY IMPORTED ${inwardCount} INWARD AND ${outwardCount} OUTWARD TRANSACTIONS FROM Fabric-2.xlsx!`);
  await mongoose.connection.close();
}

run().catch(console.error);
