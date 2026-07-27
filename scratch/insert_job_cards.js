global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');
const db = require('../src/db/models');

const rawData = [
  { jobNo: 'JOB-2630', machineName: 'GRANDO', designNo: '448', fabric: 'CEMBRIK', pcs: '104', top: '34+34', sleeve: '16', colors: 'PARPALE', panna: '58', date: '2026-07-26', pass: '1 PASS', totalMtr: '170', pnKm: 'KM', setCopy: '12', paperType: 'A++', expTime: '0H & 59M', party: 'EON', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', status: 'Done' },
  { jobNo: 'JOB-2631', machineName: 'GRANDO', designNo: '448', fabric: 'POLY MAL', pcs: '104', colors: 'PARPALE', panna: '58', dupatta: '52', cut: '2.3', date: '2026-07-26', pass: '1 PASS', totalMtr: '120', pnKm: 'KM', paperType: 'A++', expTime: '0H & 42M', party: 'EON', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', status: 'Done' },
  { jobNo: 'JOB-2632', machineName: 'PRINTDOT', designNo: 'ED-477', fabric: 'CEMBRIK', pcs: '42', colors: 'PINK', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '65', pnKm: 'KM', setCopy: '14', paperType: 'A++', expTime: '0H & 7M', party: 'EON', temperature: '225', speed: '40', designer: 'RUSHABH', colourMatching: 'RUSHABH', status: 'Done' },
  { jobNo: 'JOB-2633', machineName: 'PRINTDOT', designNo: 'ED-477', fabric: 'POLY MAL', pcs: '42', colors: 'PINK', panna: '58', dupatta: '21', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '50', pnKm: 'KM', paperType: 'A++', expTime: '0H & 6M', party: 'EON', temperature: '225', speed: '50', designer: 'RUSHABH', colourMatching: 'RUSHABH', status: 'Done' },
  { jobNo: 'JOB-2634', machineName: 'GRANDO', designNo: '559', fabric: 'POLY REYON', top: '7', sleeve: '3', colors: 'BLUE', panna: '58', bottom: '8', date: '2026-07-27', pass: '1 PASS', totalMtr: '17', pnKm: 'KM', paperType: 'A++', expTime: '0H & 6M', party: 'CS', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', note1: 'RITARN AVELA PIC', status: 'Done' },
  { jobNo: 'JOB-2635', machineName: 'PRINTDOT', designNo: '573', fabric: 'FRENCH CREP', pcs: '18', colors: 'PINK', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '18', pnKm: 'KM', paperType: 'A++', expTime: '0H & 2M', party: 'EON', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', status: 'Done' },
  { jobNo: 'JOB-2636', machineName: 'PRINTDOT', designNo: '571', fabric: 'FRENCH CREP', pcs: '120', colors: 'PINK', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '285', pnKm: 'KM', setCopy: '40', paperType: 'A++', expTime: '0H & 33M', party: 'EON', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', status: 'Done' },
  { jobNo: 'JOB-2637', machineName: 'PRINTDOT', designNo: '571', fabric: 'FRENCH CREP', pcs: '120', colors: 'PINK', panna: '58', dupatta: '60', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '138', pnKm: 'KM', paperType: 'A++', expTime: '0H & 16M', party: 'EON', temperature: '225', speed: '40', designer: 'DEVANSU', colourMatching: 'DEVANSU', status: 'Done' },
  { jobNo: 'JOB-2638', machineName: 'PRINTDOT', designNo: '574', fabric: 'FRENCH CREP', pcs: '120', colors: 'COFEE', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '500', pnKm: 'KM', paperType: 'A++', allover: '220', expTime: '0H & 57M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2639', machineName: 'PRINTDOT', designNo: '574', fabric: 'FRENCH CREP', pcs: '120', colors: 'COFEE', panna: '58', dupatta: '60', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '138', pnKm: 'KM', paperType: 'A++', expTime: '0H & 16M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2640', machineName: 'PRINTDOT', designNo: '575', fabric: 'FRENCH CREP', pcs: '120', colors: 'BLACK', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '500', pnKm: 'KM', paperType: 'A++', allover: '220', expTime: '0H & 57M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2641', machineName: 'PRINTDOT', designNo: '575', fabric: 'FRENCH CREP', pcs: '120', colors: 'BLACK', panna: '58', dupatta: '60', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '138', pnKm: 'KM', paperType: 'A++', expTime: '0H & 16M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2642', machineName: 'PRINTDOT', designNo: '461', fabric: 'FRENCH CREP', pcs: '120', colors: 'YELLOW', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '500', pnKm: 'KM', paperType: 'A++', allover: '220', expTime: '0H & 57M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2643', machineName: 'PRINTDOT', designNo: '461', fabric: 'FRENCH CREP', pcs: '120', colors: 'YELLOW', panna: '58', dupatta: '60', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '138', pnKm: 'KM', paperType: 'A++', expTime: '0H & 16M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2644', machineName: 'PRINTDOT', designNo: '560', fabric: 'FRENCH CREP', pcs: '120', colors: 'BLACK', panna: '58', date: '2026-07-27', pass: '1 PASS', totalMtr: '280', pnKm: 'KM', setCopy: '40', paperType: 'A++', allover: '220', expTime: '0H & 32M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' },
  { jobNo: 'JOB-2645', machineName: 'PRINTDOT', designNo: '560', fabric: 'FRENCH CREP', pcs: '120', colors: 'BLACK', panna: '58', dupatta: '60', cut: '2.3', date: '2026-07-27', pass: '1 PASS', totalMtr: '138', pnKm: 'KM', paperType: 'A++', expTime: '0H & 16M', party: 'EON', temperature: '225', speed: '40', designer: 'JAY', colourMatching: 'JAY', status: 'Done' }
];

async function insertAll() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to DB');

  for (const item of rawData) {
    const rawNo = item.designNo.replace(/^ED-/i, '');
    const formattedDesignName = item.designNo.startsWith('ED-') ? item.designNo : `ED-${rawNo}`;
    
    // Check design catalogue for image
    const designDoc = await db.Design.findOne({
      $or: [{ designName: formattedDesignName }, { designName: rawNo }]
    }).lean();

    const imageUrl1 = designDoc && designDoc.imageUrl ? designDoc.imageUrl : `/designs/${formattedDesignName}.jpg`;

    const docData = {
      ...item,
      designNo: item.designNo,
      designName: formattedDesignName,
      imageUrl1: imageUrl1,
      printStatus: item.status === 'Done' ? 'Printing Done' : 'Pending',
      printDate: item.date,
      fusingStatus: item.status === 'Done' ? 'Fusing Done' : 'Pending',
      fusingDate: item.date,
      deliveryStatus: item.status === 'Done' ? 'Delivery Done' : 'Delivery Pending',
      deliveryDate: item.status === 'Done' ? item.date : '',
      created_date_time: new Date(),
      modified_date_time: new Date(),
    };

    const res = await db.JobCard.findOneAndUpdate(
      { jobNo: item.jobNo },
      { $set: docData },
      { upsert: true, new: true }
    );
    console.log('Processed JobCard:', res.jobNo, '| Design:', res.designName, '| Fabric:', res.fabric, '| Status:', res.status);
  }
  console.log('All 16 Job Cards inserted successfully!');
  process.exit(0);
}

insertAll();
