const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Load polyfills if any
try {
  require('../src/polyfills/crypto');
} catch (e) {}

// Load models
const JobCard = require('../src/db/models/jobCard.model');
const Design = require('../src/db/models/design.model');

function getValString(cell) {
  if (cell === null || cell === undefined) return '';
  return cell.toString().trim();
}

async function run() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL is not set in environment!');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const workbook = new ExcelJS.Workbook();
  const filePath = '/home/ubuntu/Untitled spreadsheet-3.xlsx';
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  let added = 0;
  let updated = 0;

  for (let idx = 2; idx <= sheet.rowCount; idx++) {
    const row = sheet.getRow(idx);
    const jobNo = getValString(row.getCell(1).value);

    // Only process valid job card rows
    if (!jobNo || !jobNo.startsWith('JOB-')) {
      continue;
    }

    const rawStatus = getValString(row.getCell(34).value);
    const dateVal = getValString(row.getCell(14).value);

    let status = 'Pending';
    let printStatus = 'Printing Pending';
    let fusingStatus = 'Fusing Pending';
    let deliveryStatus = 'Delivery Pending';
    let printDate = '';
    let fusingDate = '';
    let deliveryDate = '';

    if (rawStatus.toLowerCase() === 'done') {
      status = 'Done';
      printStatus = 'Printing Done';
      fusingStatus = 'Fusing Done';
      deliveryStatus = 'Delivery Done';
      const dateStr = dateVal || new Date().toISOString().split('T')[0];
      printDate = dateStr;
      fusingDate = dateStr;
      deliveryDate = dateStr;
    } else if (rawStatus.toLowerCase() === 'in progress') {
      status = 'In Progress';
    }

    // Combine notes
    const note1 = getValString(row.getCell(29).value);
    const note2 = getValString(row.getCell(30).value);
    const emergencyNotes = getValString(row.getCell(31).value);

    // Design lookup
    const designNo = getValString(row.getCell(3).value);
    let designName = '';
    if (designNo) {
      const designDoc = await Design.findOne({ designName: { $regex: new RegExp(`^${designNo}$`, 'i') } });
      if (designDoc) {
        designName = designDoc.designName;
      }
    }

    const jobData = {
      jobNo: jobNo,
      machineName: getValString(row.getCell(2).value),
      designNo: designNo,
      designName: designName || designNo, // Fallback to designNo if designName not found
      fabric: getValString(row.getCell(4).value),
      pcs: getValString(row.getCell(5).value),
      top: getValString(row.getCell(6).value),
      sleeve: getValString(row.getCell(7).value),
      colors: getValString(row.getCell(8).value),
      panna: getValString(row.getCell(9).value),
      consumption: getValString(row.getCell(10).value),
      bottom: getValString(row.getCell(11).value),
      dupatta: getValString(row.getCell(12).value),
      cut: getValString(row.getCell(13).value),
      date: dateVal,
      pass: getValString(row.getCell(15).value),
      totalMtr: getValString(row.getCell(16).value),
      pnKm: getValString(row.getCell(17).value),
      setCopy: getValString(row.getCell(18).value),
      paperType: getValString(row.getCell(19).value),
      allover: getValString(row.getCell(20).value),
      imageUrl1: getValString(row.getCell(21).value),
      imageUrl2: getValString(row.getCell(22).value),
      expTime: getValString(row.getCell(23).value),
      designer: getValString(row.getCell(24).value),
      temperature: getValString(row.getCell(25).value),
      speed: getValString(row.getCell(26).value),
      colourMatching: getValString(row.getCell(27).value),
      profile: getValString(row.getCell(28).value),
      note1: note1,
      note2: note2,
      emergencyNotes: emergencyNotes,
      status: status,
      printStatus: printStatus,
      fusingStatus: fusingStatus,
      deliveryStatus: deliveryStatus,
      printDate: printDate,
      fusingDate: fusingDate,
      deliveryDate: deliveryDate,
    };

    // Upsert
    const existing = await JobCard.findOne({ jobNo: jobNo });
    if (existing) {
      Object.assign(existing, jobData);
      await existing.save();
      updated++;
    } else {
      await JobCard.create(jobData);
      added++;
    }
  }

  console.log(`Finished importing. Added: ${added}, Updated: ${updated}`);
  process.exit(0);
}

run().catch(console.error);
