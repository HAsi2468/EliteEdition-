const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../../../sample_hybrid_challan.pdf');
const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const PW = 595, PH = 842, ML = 45, MR = 28;
const contentWidth = PW - ML - MR; // 522

const logoPath = path.join(__dirname, '../controllers/Logo.png');
const img1 = path.join(__dirname, '../../../elite_edition_images/ED-01.jpg');
const img2 = path.join(__dirname, '../../../elite_edition_images/ED-05.jpg');

const isColorPage = true;
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

// 5. HYBRID MODULAR JOB CARDS SECTION
const jobCards = [
  {
    jobNo: 'JOB NO.- 3311',
    designNo: 'ED-01_DUPATTA',
    colour: 'Sky Blue / Coral',
    fabric: 'JORJET SHIFFON 58',
    panna: '58"',
    lotNo: '#519',
    pcs: '20',
    meters: '250.00',
    imagePath: img1
  },
  {
    jobNo: 'JOB NO.- 3312',
    designNo: 'ED-05_ALLOVER',
    colour: 'Navy / Mustard Gold',
    fabric: 'JORJET SHIFFON 58',
    panna: '58"',
    lotNo: '#519',
    pcs: '15',
    meters: '180.00',
    imagePath: img2
  }
];

let curY = billStartY + 33;

doc.fillColor(getColor('#0000ff')).fontSize(10.5).font('Helvetica-Bold')
  .text('JOB CARD & DESIGN DETAILS (ATTACHED ITEMS)', ML + 4, curY, { lineBreak: false });
curY += 15;

const cardHeight = 62;
const cardGap = 7;

jobCards.forEach((job) => {
  // Outer frame for Job Card block
  doc.strokeColor('#0000ff').lineWidth(0.7)
     .rect(ML, curY, contentWidth, cardHeight).stroke();

  // Subtle Watermark in background of the card (opacity 0.11)
  if (fs.existsSync(job.imagePath)) {
    doc.save();
    doc.rect(ML + 1, curY + 1, contentWidth - 2, cardHeight - 2).clip();
    doc.opacity(0.12);
    doc.image(job.imagePath, ML + contentWidth - 170, curY - 10, {
      width: 180,
      height: cardHeight + 20,
      fit: [180, cardHeight + 20],
      align: 'right',
      valign: 'center'
    });
    doc.restore();
  }

  // Left Crisp Photo Box
  const photoW = 54;
  const photoH = cardHeight - 8;
  const photoX = ML + 4;
  const photoY = curY + 4;

  doc.rect(photoX, photoY, photoW, photoH).fill('#ffffff');
  doc.strokeColor('#0000ff').lineWidth(0.6).rect(photoX, photoY, photoW, photoH).stroke();

  if (fs.existsSync(job.imagePath)) {
    try {
      doc.image(job.imagePath, photoX + 1.5, photoY + 1.5, {
        fit: [photoW - 3, photoH - 3],
        align: 'center',
        valign: 'center'
      });
    } catch (e) {}
  }

  // Right side details
  const textX = photoX + photoW + 8;
  const textW = contentWidth - photoW - 16;

  // Header line: Job Badge + Design No + Colour
  // Job Badge
  doc.rect(textX, curY + 4, 90, 15).fill('#e0f2fe');
  doc.strokeColor('#38bdf8').lineWidth(0.4).rect(textX, curY + 4, 90, 15).stroke();
  doc.fillColor('#0369a1').fontSize(8.5).font('Helvetica-Bold')
     .text(job.jobNo, textX + 5, curY + 7.5, { lineBreak: false });

  // Design No
  doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
     .text('DESIGN:', textX + 100, curY + 8, { lineBreak: false });
  doc.fillColor('#dc2626').fontSize(9.5).font('Helvetica-Bold')
     .text(job.designNo, textX + 144, curY + 7, { lineBreak: false });

  // Colour
  doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
     .text('COLOUR:', textX + 295, curY + 8, { lineBreak: false });
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
     .text(job.colour, textX + 342, curY + 7, { lineBreak: false });

  // Thin dividing line inside the card
  doc.strokeColor('#93c5fd').lineWidth(0.4)
     .moveTo(textX, curY + 23).lineTo(ML + contentWidth - 6, curY + 23).stroke();

  // Row 2: Fabric Quality | Panna | Lot No
  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold').text('FABRIC:', textX, curY + 27);
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(job.fabric, textX + 42, curY + 27);

  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold').text('PANNO:', textX + 195, curY + 27);
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(job.panna, textX + 235, curY + 27);

  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold').text('LOT NO:', textX + 295, curY + 27);
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(job.lotNo, textX + 338, curY + 27);

  // Row 3: Expected Pcs | Dispatched Job Meters
  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold').text('EXPECTED PCS:', textX, curY + 44);
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(job.pcs + ' pcs', textX + 75, curY + 44);

  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold').text('DISPATCHED METERS:', textX + 195, curY + 44);
  doc.fillColor('#10b981').fontSize(9.5).font('Helvetica-Bold').text(job.meters + ' mtr', textX + 295, curY + 43);

  curY += cardHeight + cardGap;
});

// 6. TP Rolls Table (Fresh, West, Total)
curY += 2;
doc.fillColor(getColor('#0000ff')).fontSize(10.5).font('Helvetica-Bold')
  .text('TP / ROLL DETAILS (ROLL BREAKDOWN)', ML + 4, curY, { lineBreak: false });
curY += 15;

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
const tpHeaderH = 20;
const tpRowH = 18;
const rowsPerTpCol = Math.ceil(tpData.length / tpCols);

// Table Header
for (let c = 0; c < tpCols; c++) {
  const x = ML + c * tpColW;
  doc.rect(x, curY, tpColW, tpHeaderH).fill('#f1f5f9');
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, curY, tpColW, tpHeaderH).stroke();

  doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('TP NO.', x, curY + 6, { width: tpColW * 0.22, align: 'center' });
  doc.text('FRESH (m)', x + tpColW * 0.22, curY + 6, { width: tpColW * 0.26, align: 'center' });
  doc.text('WEST (m)', x + tpColW * 0.48, curY + 6, { width: tpColW * 0.26, align: 'center' });
  doc.text('TOTAL (m)', x + tpColW * 0.74, curY + 6, { width: tpColW * 0.26, align: 'center' });
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
     .text(String(r.tpNo), x, y + 5, { width: tpColW * 0.22, align: 'center' });

  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
     .text(r.fresh.toFixed(2), x + tpColW * 0.22, y + 5, { width: tpColW * 0.26, align: 'center' });

  doc.fillColor('#dc2626').fontSize(8.5).font('Helvetica')
     .text(r.west.toFixed(2), x + tpColW * 0.48, y + 5, { width: tpColW * 0.26, align: 'center' });

  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
     .text(r.total.toFixed(2), x + tpColW * 0.74, y + 5, { width: tpColW * 0.26, align: 'center' });
}

curY += tpHeaderH + rowsPerTpCol * tpRowH + 12;

// 7. Summary Totals Bar
const halfW = contentWidth / 2;
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, halfW, 36).stroke();
doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
   .text('TOTAL CHALLAN TP ROLLS', ML, curY + 5, { width: halfW, align: 'center' });
doc.fillColor('#dc2626').fontSize(14).font('Helvetica-Bold')
   .text('8 ROLLS', ML, curY + 18, { width: halfW, align: 'center' });

doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML + halfW, curY, halfW, 36).stroke();
doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
   .text('TOTAL CHALLAN DISPATCHED METRES', ML + halfW, curY + 5, { width: halfW, align: 'center' });
doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold')
   .text('430.00 mtr', ML + halfW, curY + 18, { width: halfW, align: 'center' });

curY += 44;

// 8. Notes & Signatures
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, contentWidth, 24).stroke();
doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
   .text('NOTES:', ML + 6, curY + 3);
doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
   .text('Dispatched in 2 lots. Total 35 pcs dispatched via Self Drive.', ML + 45, curY + 3, { width: contentWidth - 55 });
doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
   .text('Total Pcs: 35 pcs | Total Jobs: 2 | Fresh: 420.7m | West: 9.3m', ML + 6, curY + 13);

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
  console.log('Sample Hybrid PDF generated successfully at:', outputPath);
});
