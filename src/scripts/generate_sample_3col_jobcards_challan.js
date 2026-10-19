const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputPath = '/Users/harshitsidapara/Node projects/Elite_Edition/sample_3col_jobcards_challan.pdf';
const doc = new PDFDocument({ size: 'A4', margin: 0 });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const PW = 595.28;
const PH = 841.89;
const ML = 45;
const MR = 28;
const contentWidth = PW - ML - MR; // 522.28 pt

// Outer Border
doc.strokeColor('#0000ff').lineWidth(0.8)
   .rect(ML, MR, contentWidth, PH - 2 * MR).stroke();

// 1. Top Header Strip
doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
   .text('GST : 24AANFE0044M1ZG', ML + 10, MR + 4, { lineBreak: false });
doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('|| Shree Ganeshay Namah ||', ML, MR + 4, { width: contentWidth, align: 'center', lineBreak: false });
doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica')
   .text('Mo. +91 99098 66667', ML, MR + 4, { width: contentWidth - 10, align: 'right', lineBreak: false });

doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML, MR + 14).lineTo(PW - MR, MR + 14).stroke();

// 2. Logo & Address
const logoPath = '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_website/public/elite-logo.png';
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, ML + (contentWidth - 120) / 2, MR + 18, { width: 120 });
}

// Map Pin & Address
const addressText = 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, NR. KALAPUL, Punagam, Surat';
doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold');
const textW = doc.widthOfString(addressText);
const startAddrX = ML + (contentWidth - textW) / 2;
doc.save();
doc.fillColor('#0000ff');
doc.translate(startAddrX - 8, MR + 58 + 6);
doc.moveTo(0, 0).bezierCurveTo(-3, -3, -3, -7, 0, -7).bezierCurveTo(3, -7, 3, -3, 0, 0).fill();
doc.fillColor('#ffffff').circle(0, -4, 1.2).fill();
doc.restore();
doc.text(addressText, startAddrX, MR + 58, { lineBreak: false });

doc.strokeColor('#0000ff').lineWidth(0.6)
   .moveTo(ML, MR + 70).lineTo(PW - MR, MR + 70).stroke();

// 3. M/S Party Name, Date, Challan No.
const partyY = MR + 73;
doc.fillColor('#0000ff').fontSize(11).font('Helvetica-Bold')
   .text('M/S:', ML + 8, partyY + 4, { lineBreak: false });
doc.fillColor('#0f172a').fontSize(12.5).font('Helvetica-Bold')
   .text('VG CREATIONS (SURAT)', ML + 38, partyY + 3, { lineBreak: false });

doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('DATE:', ML + 300, partyY + 4, { lineBreak: false });
doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
   .text('17/10/2026', ML + 342, partyY + 4, { lineBreak: false });

doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
   .text('CH. NO.:', ML + 420, partyY + 4, { lineBreak: false });
doc.fillColor('#dc2626').fontSize(12).font('Helvetica-Bold')
   .text('EDP-1244', ML + 472, partyY + 3, { lineBreak: false });

doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML, partyY + 22).lineTo(PW - MR, partyY + 22).stroke();

// 4. Bill To & Ship To
const billShipY = partyY + 24;
const halfW = contentWidth / 2;
doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML + halfW, billShipY - 2).lineTo(ML + halfW, billShipY + 26).stroke();

doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
   .text('BILL TO', ML + 8, billShipY);
doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
   .text('VG CREATIONS PVT LTD, SURAT', ML + 8, billShipY + 11);

doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
   .text('SHIP TO', ML + halfW + 8, billShipY);
doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
   .text('SELF DRIVE (SURAT WAREHOUSE)', ML + halfW + 8, billShipY + 11);

doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML, billShipY + 26).lineTo(PW - MR, billShipY + 26).stroke();

// 5. Common Delivery & Fabric Details Bar
const commonY = billShipY + 28;
const col4W = contentWidth / 4;
const commonFields = [
  { label: 'FABRIC', val: 'JORJET SHIFFON 58' },
  { label: 'PANNO', val: '58"' },
  { label: 'VENDOR CHALLAN', val: 'EL-1197' },
  { label: 'DELIVERY BY', val: 'SELF DRIVE' }
];

commonFields.forEach((cf, idx) => {
  const cX = ML + idx * col4W;
  if (idx > 0) {
    doc.strokeColor('#0000ff').lineWidth(0.5)
       .moveTo(cX, commonY - 2).lineTo(cX, commonY + 22).stroke();
  }
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold')
     .text(cf.label, cX + 6, commonY);
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
     .text(cf.val, cX + 6, commonY + 10, { width: col4W - 10, lineBreak: false });
});

doc.strokeColor('#0000ff').lineWidth(0.8)
   .moveTo(ML, commonY + 24).lineTo(PW - MR, commonY + 24).stroke();

// ── 6. THE 3 MAIN COLUMNS TABLE (MAXIMUM 5 JOBCARDS) ──
const tableStartY = commonY + 27;

// Column Widths
const col1W = 158; // 1st Col: Image & Job Info
const col2W = 252; // 2nd Col: TP Details with 5 rows sub-table
const col3W = 112.28; // 3rd Col: Total Mtr
// Sum: 158 + 252 + 112.28 = 522.28 (Exact match)

const tableHeaderH = 18;
// Main Table Header
doc.rect(ML, tableStartY, contentWidth, tableHeaderH).fill('#f1f5f9');
doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML, tableStartY, contentWidth, tableHeaderH).stroke();

// Vertical dividers in header
doc.strokeColor('#0000ff').lineWidth(0.6)
   .moveTo(ML + col1W, tableStartY).lineTo(ML + col1W, tableStartY + tableHeaderH).stroke();
doc.strokeColor('#0000ff').lineWidth(0.6)
   .moveTo(ML + col1W + col2W, tableStartY).lineTo(ML + col1W + col2W, tableStartY + tableHeaderH).stroke();

doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
   .text('1. DESIGN & JOB INFO', ML, tableStartY + 5, { width: col1W, align: 'center' });
doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
   .text('2. TP DETAILS (5-ROW SUB TABLE)', ML + col1W, tableStartY + 5, { width: col2W, align: 'center' });
doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
   .text('3. TOTAL MTR', ML + col1W + col2W, tableStartY + 5, { width: col3W, align: 'center' });

// 5 Job Cards Data
const jobCardsData = [
  {
    jobNo: 'JOB NO.- 3311',
    designNo: 'ED-08',
    color: 'Sky Blue / Coral',
    lotNo: '#519',
    pcs: '35 Pcs',
    imgPath: '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_images/ED-08.jpg',
    tps: [
      { tpNo: 1, mtr: 53.70 },
      { tpNo: 2, mtr: 48.80 }
    ]
  },
  {
    jobNo: 'JOB NO.- 3312',
    designNo: 'ED-09',
    color: 'Navy / Mustard',
    lotNo: '#520',
    pcs: '40 Pcs',
    imgPath: '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_images/ED-09.jpg',
    tps: [
      { tpNo: 3, mtr: 56.70 },
      { tpNo: 4, mtr: 51.00 },
      { tpNo: 5, mtr: 50.00 },
      { tpNo: 6, mtr: 60.00 },
      { tpNo: 7, mtr: 54.50 }
    ]
  },
  {
    jobNo: 'JOB NO.- 3313',
    designNo: 'ED-20',
    color: 'Pista Green / Pink',
    lotNo: '#521',
    pcs: '28 Pcs',
    imgPath: '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_images/ED-20.jpg',
    tps: [
      { tpNo: 8, mtr: 45.20 },
      { tpNo: 9, mtr: 47.60 },
      { tpNo: 10, mtr: 46.10 }
    ]
  },
  {
    jobNo: 'JOB NO.- 3314',
    designNo: 'ED-21',
    color: 'Maroon / Gold',
    lotNo: '#522',
    pcs: '50 Pcs',
    imgPath: '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_images/ED-21.jpg',
    tps: [
      { tpNo: 11, mtr: 52.00 },
      { tpNo: 12, mtr: 53.40 },
      { tpNo: 13, mtr: 49.80 },
      { tpNo: 14, mtr: 51.20 },
      { tpNo: 15, mtr: 54.10 },
      { tpNo: 16, mtr: 50.80 },
      { tpNo: 17, mtr: 51.50 }
    ]
  },
  {
    jobNo: 'JOB NO.- 3315',
    designNo: 'ED-24',
    color: 'Teal / Peach',
    lotNo: '#523',
    pcs: '32 Pcs',
    imgPath: '/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_images/ED-24.jpg',
    tps: [
      { tpNo: 18, mtr: 49.30 },
      { tpNo: 19, mtr: 52.10 },
      { tpNo: 20, mtr: 48.70 },
      { tpNo: 21, mtr: 50.20 }
    ]
  }
];

const rowH = 97; // Row height for each of the 5 jobcards (Total = 5 * 97 = 485 pt)
let currentY = tableStartY + tableHeaderH;

let grandTotalRolls = 0;
let grandTotalMeters = 0;

jobCardsData.forEach((job, idx) => {
  const rY = currentY;

  // Background alternating subtle tint for readability
  if (idx % 2 === 1) {
    doc.rect(ML, rY, contentWidth, rowH).fill('#fafafa');
  }

  // Row outer border
  doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, rY, contentWidth, rowH).stroke();

  // Column vertical dividers
  doc.strokeColor('#0000ff').lineWidth(0.5)
     .moveTo(ML + col1W, rY).lineTo(ML + col1W, rY + rowH).stroke();
  doc.strokeColor('#0000ff').lineWidth(0.5)
     .moveTo(ML + col1W + col2W, rY).lineTo(ML + col1W + col2W, rY + rowH).stroke();

  // ──────────────────────────────────────────────
  // 1ST COLUMN: IMAGE & JOB INFO
  // ──────────────────────────────────────────────
  const c1X = ML + 4;
  // Mini Header Strip inside Col 1
  const badgeH = 14;
  doc.rect(c1X, rY + 4, col1W - 8, badgeH).fill('#e0f2fe');
  doc.strokeColor('#38bdf8').lineWidth(0.4).rect(c1X, rY + 4, col1W - 8, badgeH).stroke();
  doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold')
     .text(job.jobNo, c1X + 4, rY + 7, { width: (col1W - 16) / 2, align: 'left', lineBreak: false });
  doc.fillColor('#dc2626').fontSize(8).font('Helvetica-Bold')
     .text(job.designNo, c1X + (col1W - 16) / 2, rY + 6.5, { width: (col1W - 16) / 2 + 4, align: 'right', lineBreak: false });

  // Thumbnail Image Box (Left)
  const imgBoxX = c1X;
  const imgBoxY = rY + 4 + badgeH + 4;
  const imgBoxW = 54;
  const imgBoxH = rowH - badgeH - 14; // ~69 pt

  doc.rect(imgBoxX, imgBoxY, imgBoxW, imgBoxH).fill('#f8fafc');
  doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(imgBoxX, imgBoxY, imgBoxW, imgBoxH).stroke();

  if (fs.existsSync(job.imgPath)) {
    try {
      doc.image(job.imgPath, imgBoxX + 2, imgBoxY + 2, {
        fit: [imgBoxW - 4, imgBoxH - 4],
        align: 'center',
        valign: 'center'
      });
    } catch (e) {}
  }

  // Job Meta Details (Right of image)
  const metaX = imgBoxX + imgBoxW + 6;
  const metaW = col1W - 8 - imgBoxW - 8;
  const metaStartY = imgBoxY + 2;

  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold')
     .text('COLOUR:', metaX, metaStartY);
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
     .text(job.color, metaX, metaStartY + 8, { width: metaW, lineBreak: true });

  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold')
     .text('LOT NO:', metaX, metaStartY + 26);
  doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
     .text(job.lotNo, metaX, metaStartY + 34);

  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold')
     .text('PCS / CUT:', metaX, metaStartY + 47);
  doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
     .text(job.pcs, metaX, metaStartY + 55);

  // ──────────────────────────────────────────────
  // 2ND COLUMN: TP DETAILS WITH 5-ROW SUB TABLE
  // ──────────────────────────────────────────────
  const c2X = ML + col1W + 6;
  const subTableW = col2W - 12; // 240 pt
  const subTableY = rY + 6;
  const subHeadH = 13;
  const subRowH = 14;
  const subRowsCount = 5; // Exactly 5 rows as requested!
  const halfSubW = subTableW / 2; // 120 pt each (allows 2 sets of TP No & Mtr to fit up to 10 rolls!)

  // Sub Table Header
  doc.rect(c2X, subTableY, subTableW, subHeadH).fill('#e2e8f0');
  doc.strokeColor('#0000ff').lineWidth(0.4).rect(c2X, subTableY, subTableW, subHeadH).stroke();

  // Divider between sub columns
  doc.strokeColor('#0000ff').lineWidth(0.4)
     .moveTo(c2X + halfSubW, subTableY).lineTo(c2X + halfSubW, subTableY + subHeadH + subRowsCount * subRowH).stroke();

  // Headers for Sub-column 1
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold')
     .text('TP NO.', c2X, subTableY + 3.5, { width: halfSubW * 0.4, align: 'center' });
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold')
     .text('METRES', c2X + halfSubW * 0.4, subTableY + 3.5, { width: halfSubW * 0.6, align: 'center' });

  // Headers for Sub-column 2
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold')
     .text('TP NO.', c2X + halfSubW, subTableY + 3.5, { width: halfSubW * 0.4, align: 'center' });
  doc.fillColor('#0000ff').fontSize(7).font('Helvetica-Bold')
     .text('METRES', c2X + halfSubW + halfSubW * 0.4, subTableY + 3.5, { width: halfSubW * 0.6, align: 'center' });

  // Draw 5 rows
  for (let r = 0; r < subRowsCount; r++) {
    const curSubRowY = subTableY + subHeadH + r * subRowH;

    // Horizontal line for each sub row
    doc.strokeColor('#94a3b8').lineWidth(0.3)
       .rect(c2X, curSubRowY, subTableW, subRowH).stroke();

    // Inner vertical dividers for TP No | Meters
    doc.strokeColor('#94a3b8').lineWidth(0.3)
       .moveTo(c2X + halfSubW * 0.4, curSubRowY).lineTo(c2X + halfSubW * 0.4, curSubRowY + subRowH).stroke();
    doc.strokeColor('#94a3b8').lineWidth(0.3)
       .moveTo(c2X + halfSubW + halfSubW * 0.4, curSubRowY).lineTo(c2X + halfSubW + halfSubW * 0.4, curSubRowY + subRowH).stroke();

    // Left Column item (index r)
    const tpLeft = job.tps[r];
    if (tpLeft) {
      doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
         .text(String(tpLeft.tpNo), c2X, curSubRowY + 3.5, { width: halfSubW * 0.4, align: 'center' });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
         .text(`${tpLeft.mtr.toFixed(2)} m`, c2X + halfSubW * 0.4, curSubRowY + 3.5, { width: halfSubW * 0.6, align: 'center' });
    } else {
      doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica')
         .text('—', c2X, curSubRowY + 3.5, { width: halfSubW * 0.4, align: 'center' });
      doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica')
         .text('—', c2X + halfSubW * 0.4, curSubRowY + 3.5, { width: halfSubW * 0.6, align: 'center' });
    }

    // Right Column item (index r + 5)
    const tpRight = job.tps[r + 5];
    if (tpRight) {
      doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
         .text(String(tpRight.tpNo), c2X + halfSubW, curSubRowY + 3.5, { width: halfSubW * 0.4, align: 'center' });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
         .text(`${tpRight.mtr.toFixed(2)} m`, c2X + halfSubW + halfSubW * 0.4, curSubRowY + 3.5, { width: halfSubW * 0.6, align: 'center' });
    } else {
      doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica')
         .text('—', c2X + halfSubW, curSubRowY + 3.5, { width: halfSubW * 0.4, align: 'center' });
      doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica')
         .text('—', c2X + halfSubW + halfSubW * 0.4, curSubRowY + 3.5, { width: halfSubW * 0.6, align: 'center' });
    }
  }

  // ──────────────────────────────────────────────
  // 3RD COLUMN: TOTAL MTR
  // ──────────────────────────────────────────────
  const c3X = ML + col1W + col2W;
  const totalMtrJob = job.tps.reduce((acc, t) => acc + t.mtr, 0);
  const totalRollsJob = job.tps.length;

  grandTotalRolls += totalRollsJob;
  grandTotalMeters += totalMtrJob;

  const totalCenterY = rY + (rowH - 52) / 2;

  doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold')
     .text('JOB TOTAL', c3X, totalCenterY, { width: col3W, align: 'center' });

  // Badge for Rolls
  const rollBadgeW = 58;
  const rollBadgeH = 15;
  const rollBadgeX = c3X + (col3W - rollBadgeW) / 2;
  doc.rect(rollBadgeX, totalCenterY + 11, rollBadgeW, rollBadgeH).fill('#eff6ff');
  doc.strokeColor('#0000ff').lineWidth(0.4).rect(rollBadgeX, totalCenterY + 11, rollBadgeW, rollBadgeH).stroke();
  doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
     .text(`${totalRollsJob} Rolls`, rollBadgeX, totalCenterY + 14, { width: rollBadgeW, align: 'center' });

  // Big Emerald Green Total Meters
  doc.fillColor('#10b981').fontSize(12).font('Helvetica-Bold')
     .text(`${totalMtrJob.toFixed(2)} mtr`, c3X, totalCenterY + 30, { width: col3W, align: 'center' });

  const avgPerRoll = totalMtrJob / (totalRollsJob || 1);
  doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
     .text(`Avg: ${avgPerRoll.toFixed(1)} m/roll`, c3X, totalCenterY + 45, { width: col3W, align: 'center' });

  currentY += rowH;
});

// ── 7. GRAND TOTAL ROW ──
const grandTotalY = currentY;
const grandTotalH = 26;
doc.rect(ML, grandTotalY, contentWidth, grandTotalH).fill('#f8fafc');
doc.strokeColor('#0000ff').lineWidth(0.7).rect(ML, grandTotalY, contentWidth, grandTotalH).stroke();

// Divider lines in grand total row
doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML + col1W, grandTotalY).lineTo(ML + col1W, grandTotalY + grandTotalH).stroke();
doc.strokeColor('#0000ff').lineWidth(0.5)
   .moveTo(ML + col1W + col2W, grandTotalY).lineTo(ML + col1W + col2W, grandTotalY + grandTotalH).stroke();

doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('GRAND TOTAL (5 JOBS)', ML + 10, grandTotalY + 8);

doc.fillColor('#dc2626').fontSize(11).font('Helvetica-Bold')
   .text(`TOTAL ROLLS: ${grandTotalRolls}`, ML + col1W + 10, grandTotalY + 7);

doc.fillColor('#10b981').fontSize(13).font('Helvetica-Bold')
   .text(`${grandTotalMeters.toFixed(2)} mtr`, ML + col1W + col2W, grandTotalY + 6, { width: col3W, align: 'center' });

// ── 8. NOTES & REMARKS ──
const notesY = grandTotalY + grandTotalH + 5;
const notesH = 24;
doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, notesY, contentWidth, notesH).stroke();
doc.fillColor('#0000ff').fontSize(7.5).font('Helvetica-Bold')
   .text('NOTES / REMARKS', ML + 10, notesY + 3);
doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
   .text('Dispatched via Self Drive in 5 lots. All fabrics inspected, sealed and approved for stitching.', ML + 10, notesY + 12);

// ── 9. SIGNATURES ──
const sigLineY = PH - MR - 40;
doc.moveTo(ML + 30, sigLineY).lineTo(ML + 160, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('RECEIVER SIGNATURE', ML + 30, sigLineY + 5, { width: 130, align: 'center' });

doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
   .text('HASI', PW - MR - 160, sigLineY - 14, { width: 130, align: 'center' });
doc.moveTo(PW - MR - 160, sigLineY).lineTo(PW - MR - 30, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
   .text('AUTHORIZED SIGNATURE', PW - MR - 160, sigLineY + 5, { width: 130, align: 'center' });

doc.end();

stream.on('finish', () => {
  console.log('Sample 3-Column JobCards Challan PDF generated successfully at:', outputPath);
});
