const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../../../sample_bottom_seated_challan.pdf');
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

// 4. Standard Details Grid (100% EXACT ORIGINAL DETAILS — NO CHANGES)
function renderField(label, value, x, y, width, height) {
  doc.strokeColor(getColor('#0000ff')).lineWidth(0.5).rect(x, y, width, height).stroke();
  doc.fillColor(getColor('#0000ff')).fontSize(8.5).font('Helvetica-Bold')
    .text(label.toUpperCase(), x + 6, y + 3, { width: width - 12, lineBreak: false });

  const valStr = String(value || '—').trim();
  let fSize = 10;
  if (valStr.length > 25) fSize = 7.5;
  else if (valStr.length > 16) fSize = 8.5;

  doc.fillColor(getColor('#0f172a')).fontSize(fSize).font('Helvetica-Bold')
    .text(valStr, x + 6, y + 14, { width: width - 12, lineBreak: false });
}

const billStartY = startY + 23;
const halfWidth = contentWidth / 2;
renderField('Bill to', 'VG CREATIONS PVT LTD, SURAT', ML, billStartY, halfWidth, 28);
renderField('Ship to', 'SELF DRIVE (SURAT WAREHOUSE)', ML + halfWidth, billStartY, halfWidth, 28);

const gridStartY = billStartY + 28;
const colWidth4 = contentWidth / 4;

renderField('Job No.', 'JOB NO.- 3311, 3312', ML, gridStartY, colWidth4, 28);
renderField('Design No.', 'ED-01_DUPATTA, ED-05_ALLOVER', ML + colWidth4, gridStartY, colWidth4, 28);
renderField('Lot No.', '#519', ML + colWidth4 * 2, gridStartY, colWidth4, 28);
renderField('Panno', '58"', ML + colWidth4 * 3, gridStartY, colWidth4, 28);

renderField('Colour', 'Sky Blue, Navy', ML, gridStartY + 28, colWidth4, 28);
renderField('Fabric', 'JORJET SHIFFON 58', ML + colWidth4, gridStartY + 28, colWidth4, 28);
renderField('Vendor Challan', 'EL-1197', ML + colWidth4 * 2, gridStartY + 28, colWidth4, 28);
renderField('Delivery By', 'SELF DRIVE', ML + colWidth4 * 3, gridStartY + 28, colWidth4, 28);

// 5. TP Details Table (Standard Layout)
const tpSectionY = gridStartY + 56 + 10;
doc.fillColor(getColor('#0000ff')).fontSize(11).font('Helvetica-Bold')
  .text('TP Details', ML + 12, tpSectionY, { lineBreak: false });

const tpData = [
  { tpNo: 1, meter: 53.70 },
  { tpNo: 2, meter: 48.80 },
  { tpNo: 3, meter: 56.70 },
  { tpNo: 4, meter: 51.00 },
  { tpNo: 5, meter: 50.00 },
  { tpNo: 6, meter: 60.00 },
  { tpNo: 7, meter: 54.50 },
];

const tpTableStartY = tpSectionY + 16;
const tpColsCount = 2;
const tpColWidth = contentWidth / tpColsCount;
const rowsPerCol = Math.ceil(tpData.length / tpColsCount);
const tpRowHeight = 18;
const tableHeaderHeight = 20;

// Table Column Headers
for (let c = 0; c < tpColsCount; c++) {
  const x = ML + c * tpColWidth;
  doc.rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).fill('#f8fafc');
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).stroke();

  doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold');
  doc.text('TP NO.', x, tpTableStartY + 6, { width: tpColWidth * 0.35, align: 'center' });
  doc.text('METRES', x + tpColWidth * 0.35, tpTableStartY + 6, { width: tpColWidth * 0.65, align: 'center' });
}

// Table Rows
for (let i = 0; i < tpData.length; i++) {
  const tp = tpData[i];
  const colIndex = Math.floor(i / rowsPerCol);
  const rowIndex = i % rowsPerCol;

  const x = ML + colIndex * tpColWidth;
  const y = tpTableStartY + tableHeaderHeight + rowIndex * tpRowHeight;

  doc.strokeColor('#0000ff').lineWidth(0.4).rect(x, y, tpColWidth, tpRowHeight).stroke();

  doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
     .text(String(tp.tpNo), x, y + 4.5, { width: tpColWidth * 0.35, align: 'center' });
  
  doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica')
     .text(`${tp.meter.toFixed(2)} mtr`, x + tpColWidth * 0.35, y + 4.5, { width: tpColWidth * 0.65, align: 'center' });
}

const summaryStartY = tpTableStartY + tableHeaderHeight + (rowsPerCol * tpRowHeight) + 10;
const summaryColWidth2 = contentWidth / 2;

// 6. Summary Totals Bar
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, summaryStartY, summaryColWidth2, 38).stroke();
doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('TOTAL CHALLAN TP', ML, summaryStartY + 5, { width: summaryColWidth2, align: 'center' });
doc.fillColor('#dc2626').fontSize(15).font('Helvetica-Bold')
   .text('7', ML, summaryStartY + 18, { width: summaryColWidth2, align: 'center' });

doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML + summaryColWidth2, summaryStartY, summaryColWidth2, 38).stroke();
doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('TOTAL CHALLAN METRES', ML + summaryColWidth2, summaryStartY + 5, { width: summaryColWidth2, align: 'center' });
doc.fillColor('#10b981').fontSize(15).font('Helvetica-Bold')
   .text('374.70 mtr', ML + summaryColWidth2, summaryStartY + 18, { width: summaryColWidth2, align: 'center' });

// 7. Notes
const notesY = summaryStartY + 45;
const notesH = 28;
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, notesY, contentWidth, notesH).stroke();
doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
   .text('NOTES / REMARKS', ML + 10, notesY + 3);
doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
   .text('Dispatched via Self Drive in 2 lots. Expected Pcs: 35 pcs.', ML + 10, notesY + 14);

const notesEndY = notesY + notesH;

// 8. SIGNATURE LINE POSITIONS
const sigLineY = PH - MR - 45;

// ── 9. SEAT MULTIPLE DESIGN IMAGES SIDE-BY-SIDE IN A ROW AT THE BOTTOM ──
const imagesList = [
  {
    path: img1,
    jobNo: 'JOB NO.- 3311',
    designNo: 'ED-01_DUPATTA',
    color: 'Sky Blue / Coral',
    tpSummary: 'TP No: 1, 2 (2 Rolls)',
    meterSummary: '102.50 mtr'
  },
  {
    path: img2,
    jobNo: 'JOB NO.- 3312',
    designNo: 'ED-05_ALLOVER',
    color: 'Navy / Mustard Gold',
    tpSummary: 'TP No: 3, 4, 5, 6, 7 (5 Rolls)',
    meterSummary: '272.20 mtr'
  }
];

// Calculate available vertical space between notes and signature line
const availableImgH = sigLineY - notesEndY - 12;
const cardH = Math.min(115, Math.max(75, availableImgH));
const numImages = imagesList.length;

// Sizing for side-by-side cards
const gap = 16;
const cardW = Math.min(175, Math.floor((contentWidth - (numImages - 1) * gap) / numImages));
const totalRowW = numImages * cardW + (numImages - 1) * gap;
const startImgX = ML + (contentWidth - totalRowW) / 2; // Perfectly centered row
const startImgY = notesEndY + (availableImgH - cardH) / 2 + 6;

imagesList.forEach((item, idx) => {
  const cX = startImgX + idx * (cardW + gap);
  const cY = startImgY;

  // Outer frame box for each design image card
  doc.rect(cX, cY, cardW, cardH).fill('#ffffff');
  doc.strokeColor('#0000ff').lineWidth(0.7).rect(cX, cY, cardW, cardH).stroke();

  // Top header inside image card (Job No badge + Design No)
  const headerBadgeH = 16;
  doc.rect(cX, cY, cardW, headerBadgeH).fill('#e0f2fe');
  doc.strokeColor('#0284c7').lineWidth(0.5).rect(cX, cY, cardW, headerBadgeH).stroke();
  doc.fillColor('#0369a1').fontSize(8).font('Helvetica-Bold')
     .text(item.jobNo, cX + 4, cY + 4, { width: cardW * 0.48, align: 'left', lineBreak: false });
  doc.fillColor('#dc2626').fontSize(8).font('Helvetica-Bold')
     .text(item.designNo, cX + cardW * 0.48, cY + 4, { width: cardW * 0.50, align: 'right', lineBreak: false });

  // Photo container
  const footerH = 24;
  const photoContainerH = cardH - headerBadgeH - footerH - 4;
  if (fs.existsSync(item.path)) {
    try {
      doc.image(item.path, cX + 4, cY + headerBadgeH + 2, {
        fit: [cardW - 8, photoContainerH],
        align: 'center',
        valign: 'center'
      });
    } catch (e) {}
  }

  // Bottom Footer Strip: TP Numbers & Total Dispatched Meters for this Job Card
  const labelY = cY + cardH - footerH;
  doc.rect(cX, labelY, cardW, footerH).fill('#f8fafc');
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(cX, labelY, cardW, footerH).stroke();

  // Line 1: TP Numbers list for this job
  doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
     .text(item.tpSummary, cX + 3, labelY + 3, { width: cardW - 6, align: 'center', lineBreak: false });

  // Line 2: Job Dispatched Meters
  doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold')
     .text(item.meterSummary, cX + 3, labelY + 12.5, { width: cardW - 6, align: 'center', lineBreak: false });
});

// 10. Signatures
doc.moveTo(ML + 30, sigLineY).lineTo(ML + 160, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('RECEIVER SIGNATURE', ML + 30, sigLineY + 5, { width: 130, align: 'center' });

doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('HASI', PW - MR - 160, sigLineY - 14, { width: 130, align: 'center' });
doc.moveTo(PW - MR - 160, sigY = sigLineY).lineTo(PW - MR - 30, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('AUTHORIZED SIGNATURE', PW - MR - 160, sigLineY + 5, { width: 130, align: 'center' });

doc.end();

stream.on('finish', () => {
  console.log('Sample Bottom Seated Images PDF generated successfully at:', outputPath);
});
