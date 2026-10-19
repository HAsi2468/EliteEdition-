const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../../../sample_itemized_challan.pdf');
const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const PW = 595, PH = 842, ML = 45, MR = 28;
const contentWidth = PW - ML - MR; // 522

const logoPath = path.join(__dirname, '../controllers/Logo.png');
const img1 = path.join(__dirname, '../../../elite_edition_images/ED-01.jpg');
const img2 = path.join(__dirname, '../../../elite_edition_images/ED-05.jpg');
const img3 = path.join(__dirname, '../../../elite_edition_images/ED-08.jpg');

const getColor = (c) => c;

// 1. Draw outer border
doc.strokeColor(getColor('#0000ff')).lineWidth(1)
   .rect(ML, MR, contentWidth, PH - 2 * MR).stroke();

// 2. Top header
doc.fillColor(getColor('#0000ff')).fontSize(10).font('Helvetica')
  .text('GST : 24AANFE0044M1ZG', ML + 12, MR + 4, { lineBreak: false });
doc.fillColor(getColor('#0000ff')).fontSize(10).font('Helvetica-Bold')
  .text('|| Shree Ganeshay Namah ||', ML, MR + 4, { width: contentWidth, align: 'center', lineBreak: false });
doc.fillColor(getColor('#0000ff')).fontSize(10).font('Helvetica')
  .text('Mo. +91 99098 66667', ML, MR + 4, { width: contentWidth - 12, align: 'right', lineBreak: false });

doc.strokeColor(getColor('#0000ff')).lineWidth(0.5)
  .moveTo(ML, MR + 14).lineTo(PW - MR, MR + 14).stroke();

// Logo
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, ML + (contentWidth - 130) / 2, MR + 22, { width: 130 });
}

// Map Pin & Address
const drawMapPin = (d, x, y) => {
  d.save();
  d.fillColor('#0000ff');
  d.translate(x, y);
  d.moveTo(0, 0)
   .bezierCurveTo(-4, -4, -4, -9, 0, -9)
   .bezierCurveTo(4, -9, 4, -4, 0, 0)
   .fill();
  d.fillColor('#ffffff').circle(0, -5, 1.5).fill();
  d.restore();
};

const addressText = 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, NR. KALAPUL, Punagam, Surat';
doc.fillColor(getColor('#0000ff')).fontSize(9).font('Helvetica-Bold');
const textWidth = doc.widthOfString(addressText);
const startX = ML + (contentWidth - textWidth) / 2;
drawMapPin(doc, startX - 8, MR + 70 + 7);
doc.text(addressText, startX, MR + 70, { lineBreak: false });

doc.strokeColor(getColor('#0000ff')).lineWidth(0.8)
  .moveTo(ML, MR + 84).lineTo(PW - MR, MR + 84).stroke();

// 3. Party & Challan Strip
const startY = MR + 88;
doc.fillColor(getColor('#0000ff')).fontSize(11).font('Helvetica-Bold')
  .text('M/S:', ML + 10, startY + 5, { lineBreak: false });
doc.fillColor(getColor('#0f172a')).fontSize(13).font('Helvetica-Bold')
  .text('VG CREATIONS (SURAT)', ML + 38, startY + 3.5, { lineBreak: false });

doc.fillColor(getColor('#0000ff')).fontSize(11).font('Helvetica-Bold')
  .text('DATE:', PW - MR - 225, startY + 5, { width: 45, align: 'right', lineBreak: false });
doc.fillColor(getColor('#0f172a')).fontSize(12).font('Helvetica-Bold')
  .text('17/10/2026', PW - MR - 175, startY + 5, { width: 75, align: 'left', lineBreak: false });

doc.fillColor(getColor('#0000ff')).fontSize(11).font('Helvetica-Bold')
  .text('CH. NO.:', PW - MR - 105, startY + 5, { width: 50, align: 'right', lineBreak: false });
doc.fillColor(getColor('#dc2626')).fontSize(13.5).font('Helvetica-Bold')
  .text('EDP-1244', PW - MR - 55, startY + 3.5, { width: 50, align: 'right', lineBreak: false });

doc.strokeColor(getColor('#0000ff')).lineWidth(0.6)
  .moveTo(ML, startY + 23).lineTo(PW - MR, startY + 23).stroke();

// 4. Bill To & Ship To
function renderField(label, value, x, y, width, height) {
  doc.strokeColor(getColor('#0000ff')).lineWidth(0.5).rect(x, y, width, height).stroke();
  doc.fillColor(getColor('#0000ff')).fontSize(8.5).font('Helvetica-Bold')
    .text(label.toUpperCase(), x + 6, y + 3, { width: width - 12, lineBreak: false });
  doc.fillColor(getColor('#0f172a')).fontSize(10).font('Helvetica-Bold')
    .text(String(value || '—'), x + 6, y + 14, { width: width - 12, lineBreak: false });
}

const billStartY = startY + 23;
const halfWidth = contentWidth / 2;
renderField('Bill to', 'VG CREATIONS PVT LTD, SURAT', ML, billStartY, halfWidth, 28);
renderField('Ship to', 'SELF DRIVE (SURAT WAREHOUSE)', ML + halfWidth, billStartY, halfWidth, 28);

// 5. SOLUTION 1: ITEMIZED JOBCARDS TABLE WITH INLINE DESIGN THUMBNAILS
let curY = billStartY + 33;

doc.fillColor(getColor('#0000ff')).fontSize(10.5).font('Helvetica-Bold')
  .text('ITEMIZED JOB CARDS & DESIGN DETAILS', ML + 4, curY, { lineBreak: false });
curY += 15;

// Table column widths (total = 522)
// [Photo: 48] [Job & Lot: 82] [Design: 110] [Colour: 92] [Fabric/Panna: 90] [Pcs: 40] [Meters: 60]
const colW = {
  photo: 46,
  job: 84,
  design: 108,
  colour: 94,
  fabric: 90,
  pcs: 40,
  meters: 60
};

const tableHeaderH = 22;

// Draw Table Header
doc.rect(ML, curY, contentWidth, tableHeaderH).fill('#f1f5f9');
doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML, curY, contentWidth, tableHeaderH).stroke();

// Vertical grid separators in header
let accX = ML;
doc.strokeColor('#0000ff').lineWidth(0.5);
doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold');

doc.text('PREVIEW', accX, curY + 7, { width: colW.photo, align: 'center' });
accX += colW.photo;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('JOB & LOT', accX, curY + 7, { width: colW.job, align: 'center' });
accX += colW.job;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('DESIGN NO.', accX, curY + 7, { width: colW.design, align: 'center' });
accX += colW.design;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('COLOUR', accX, curY + 7, { width: colW.colour, align: 'center' });
accX += colW.colour;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('FABRIC & PANNO', accX, curY + 7, { width: colW.fabric, align: 'center' });
accX += colW.fabric;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('PCS', accX, curY + 7, { width: colW.pcs, align: 'center' });
accX += colW.pcs;
doc.moveTo(accX, curY).lineTo(accX, curY + tableHeaderH).stroke();

doc.text('METRES', accX, curY + 7, { width: colW.meters, align: 'center' });

curY += tableHeaderH;

// Rows data
const items = [
  {
    jobNo: 'JOB NO.- 3311',
    lotNo: '#519',
    designNo: 'ED-01_DUPATTA',
    colour: 'Sky Blue / Coral',
    fabric: 'JORJET SHIFFON',
    panna: '58"',
    pcs: '20',
    meters: '250.00',
    imagePath: img1
  },
  {
    jobNo: 'JOB NO.- 3312',
    lotNo: '#519',
    designNo: 'ED-05_ALLOVER',
    colour: 'Navy / Mustard Gold',
    fabric: 'JORJET SHIFFON',
    panna: '58"',
    pcs: '15',
    meters: '180.00',
    imagePath: img2
  }
];

const itemRowH = 46; // Compact, clean row height allowing 40px photo thumbnail

items.forEach((item, idx) => {
  const rowY = curY;
  
  // Row boundary
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, rowY, contentWidth, itemRowH).stroke();
  
  let x = ML;

  // 1. Photo Thumbnail Column
  const thumbBoxSize = 38;
  const thumbX = x + (colW.photo - thumbBoxSize) / 2;
  const thumbY = rowY + (itemRowH - thumbBoxSize) / 2;

  doc.rect(thumbX, thumbY, thumbBoxSize, thumbBoxSize).fill('#ffffff');
  doc.strokeColor('#cbd5e1').lineWidth(0.4).rect(thumbX, thumbY, thumbBoxSize, thumbBoxSize).stroke();

  if (fs.existsSync(item.imagePath)) {
    try {
      doc.image(item.imagePath, thumbX + 1, thumbY + 1, {
        fit: [thumbBoxSize - 2, thumbBoxSize - 2],
        align: 'center',
        valign: 'center'
      });
    } catch (e) {}
  }

  x += colW.photo;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 2. Job & Lot Column
  // Job Badge
  doc.rect(x + 5, rowY + 7, colW.job - 10, 14).fill('#e0f2fe');
  doc.fillColor('#0369a1').fontSize(7.5).font('Helvetica-Bold')
     .text(item.jobNo, x + 5, rowY + 10, { width: colW.job - 10, align: 'center' });

  // Lot No
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold').text('LOT:', x + 8, rowY + 27);
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(item.lotNo, x + 30, rowY + 27);

  x += colW.job;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 3. Design No Column
  doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold')
     .text(item.designNo, x + 6, rowY + 16, { width: colW.design - 12, lineBreak: true });

  x += colW.design;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 4. Colour Column
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
     .text(item.colour, x + 6, rowY + 16, { width: colW.colour - 12, lineBreak: true });

  x += colW.colour;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 5. Fabric & Panno Column
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
     .text(item.fabric, x + 6, rowY + 12, { width: colW.fabric - 12 });
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
     .text(`Panna: ${item.panna}`, x + 6, rowY + 26);

  x += colW.fabric;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 6. Pcs Column
  doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
     .text(`${item.pcs}`, x, rowY + 16, { width: colW.pcs, align: 'center' });

  x += colW.pcs;
  doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(x, rowY).lineTo(x, rowY + itemRowH).stroke();

  // 7. Meters Column
  doc.fillColor('#10b981').fontSize(10).font('Helvetica-Bold')
     .text(`${item.meters}`, x, rowY + 16, { width: colW.meters - 6, align: 'right' });

  curY += itemRowH;
});

// Table Subtotal Summary Row
doc.rect(ML, curY, contentWidth, 20).fill('#f8fafc');
doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML, curY, contentWidth, 20).stroke();

doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
   .text('ITEMS TOTAL:', ML + 12, curY + 6);

// Pcs total
const pcsX = ML + colW.photo + colW.job + colW.design + colW.colour + colW.fabric;
doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
   .text('35 pcs', pcsX, curY + 6, { width: colW.pcs, align: 'center' });

// Meters total
const mtrX = pcsX + colW.pcs;
doc.fillColor('#10b981').fontSize(9.5).font('Helvetica-Bold')
   .text('430.00 m', mtrX, curY + 6, { width: colW.meters - 6, align: 'right' });

curY += 28;

// 6. TP Rolls Table (Fresh, West, Total)
doc.fillColor(getColor('#0000ff')).fontSize(10.5).font('Helvetica-Bold')
  .text('TP / ROLL DETAILS (ROLL-WISE BREAKDOWN)', ML + 4, curY, { lineBreak: false });
curY += 14;

const tpData = [
  { tpNo: 1, fresh: 52.5, west: 1.2, total: 53.7 },
  { tpNo: 2, fresh: 48.0, west: 0.8, total: 48.8 },
  { tpNo: 3, fresh: 55.2, west: 1.5, total: 56.7 },
  { tpNo: 4, fresh: 50.0, west: 1.0, total: 51.0 },
  { tpNo: 5, fresh: 49.5, west: 0.5, total: 50.0 },
  { tpNo: 6, fresh: 58.0, west: 2.0, total: 60.0 },
  { tpNo: 7, fresh: 53.4, west: 1.1, total: 54.5 },
  { tpNo: 8, fresh: 54.1, west: 1.2, total: 55.3 },
];

const tpCols = 2;
const tpColW = contentWidth / tpCols;
const tpHeaderH = 19;
const tpRowH = 17;
const rowsPerTpCol = Math.ceil(tpData.length / tpCols);

// Table Header
for (let c = 0; c < tpCols; c++) {
  const x = ML + c * tpColW;
  doc.rect(x, curY, tpColW, tpHeaderH).fill('#f1f5f9');
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, curY, tpColW, tpHeaderH).stroke();

  doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('TP NO.', x, curY + 5, { width: tpColW * 0.22, align: 'center' });
  doc.text('FRESH (m)', x + tpColW * 0.22, curY + 5, { width: tpColW * 0.26, align: 'center' });
  doc.text('WEST (m)', x + tpColW * 0.48, curY + 5, { width: tpColW * 0.26, align: 'center' });
  doc.text('TOTAL (m)', x + tpColW * 0.74, curY + 5, { width: tpColW * 0.26, align: 'center' });
}

// Rows
for (let i = 0; i < tpData.length; i++) {
  const r = tpData[i];
  const cIdx = Math.floor(i / rowsPerTpCol);
  const rIdx = i % rowsPerTpCol;
  const x = ML + cIdx * tpColW;
  const y = curY + tpHeaderH + rIdx * tpRowH;

  doc.strokeColor('#0000ff').lineWidth(0.4).rect(x, y, tpColW, tpRowH).stroke();

  doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
     .text(String(r.tpNo), x, y + 4.5, { width: tpColW * 0.22, align: 'center' });

  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
     .text(r.fresh.toFixed(2), x + tpColW * 0.22, y + 4.5, { width: tpColW * 0.26, align: 'center' });

  doc.fillColor('#dc2626').fontSize(8.5).font('Helvetica')
     .text(r.west.toFixed(2), x + tpColW * 0.48, y + 4.5, { width: tpColW * 0.26, align: 'center' });

  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
     .text(r.total.toFixed(2), x + tpColW * 0.74, y + 4.5, { width: tpColW * 0.26, align: 'center' });
}

curY += tpHeaderH + rowsPerTpCol * tpRowH + 12;

// 7. Overall Summary Totals Bar
const summaryHalfW = contentWidth / 2;
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, summaryHalfW, 36).stroke();
doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
   .text('TOTAL CHALLAN TP ROLLS', ML, curY + 5, { width: summaryHalfW, align: 'center' });
doc.fillColor('#dc2626').fontSize(14).font('Helvetica-Bold')
   .text('8 ROLLS', ML, curY + 18, { width: summaryHalfW, align: 'center' });

doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML + summaryHalfW, curY, summaryHalfW, 36).stroke();
doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
   .text('TOTAL CHALLAN DISPATCHED METRES', ML + summaryHalfW, curY + 5, { width: summaryHalfW, align: 'center' });
doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold')
   .text('430.00 mtr', ML + summaryHalfW, curY + 18, { width: summaryHalfW, align: 'center' });

curY += 44;

// 8. Notes & Remarks
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, contentWidth, 24).stroke();
doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
   .text('NOTES:', ML + 6, curY + 3);
doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
   .text('Dispatched in 2 lots. Total 35 pcs dispatched via Self Drive.', ML + 45, curY + 3, { width: contentWidth - 55 });
doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
   .text('Total Pcs: 35 pcs | Total Jobs: 2 | Fresh: 420.7m | West: 9.3m', ML + 6, curY + 13);

// 9. Signatures
const sigY = PH - MR - 40;
doc.moveTo(ML + 30, sigY).lineTo(ML + 160, sigY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('RECEIVER SIGNATURE', ML + 30, sigY + 5, { width: 130, align: 'center' });

doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('HASI', PW - MR - 160, sigY - 14, { width: 130, align: 'center' });
doc.moveTo(PW - MR - 160, sigY).lineTo(PW - MR - 30, sigY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('AUTHORIZED SIGNATURE', PW - MR - 160, sigY + 5, { width: 130, align: 'center' });

doc.end();

stream.on('finish', () => {
  console.log('Sample Itemized Table PDF generated successfully at:', outputPath);
});
