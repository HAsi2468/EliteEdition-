const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../controllers/Logo.png');
const img1 = path.join(__dirname, '../../../elite_edition_images/ED-01.jpg');
const img2 = path.join(__dirname, '../../../elite_edition_images/ED-05.jpg');

const jobGroups = [
  {
    jobNo: 'JOB NO.- 3311',
    lotNo: '#519',
    designNo: 'ED-01_DUPATTA',
    colour: 'Sky Blue / Coral',
    fabric: 'JORJET SHIFFON 58"',
    pcs: '20 pcs',
    imagePath: img1,
    tps: [
      { tpNo: 1, fresh: 52.5, west: 1.2, total: 53.7 },
      { tpNo: 2, fresh: 48.0, west: 0.8, total: 48.8 },
    ]
  },
  {
    jobNo: 'JOB NO.- 3312',
    lotNo: '#519',
    designNo: 'ED-05_ALLOVER',
    colour: 'Navy / Mustard Gold',
    fabric: 'JORJET SHIFFON 58"',
    pcs: '15 pcs',
    imagePath: img2,
    tps: [
      { tpNo: 1, fresh: 55.2, west: 1.5, total: 56.7 },
      { tpNo: 2, fresh: 50.0, west: 1.0, total: 51.0 },
      { tpNo: 3, fresh: 49.5, west: 0.5, total: 50.0 },
      { tpNo: 4, fresh: 58.0, west: 2.0, total: 60.0 },
      { tpNo: 5, fresh: 53.4, west: 1.1, total: 54.5 },
    ]
  }
];

function generateChallanWithOpacity(targetOpacity, outputFilePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    const stream = fs.createWriteStream(outputFilePath);
    doc.pipe(stream);

    const PW = 595, PH = 842, ML = 45, MR = 28;
    const contentWidth = PW - ML - MR; // 522

    // 1. Draw outer border
    doc.strokeColor('#0000ff').lineWidth(1)
       .rect(ML, MR, contentWidth, PH - 2 * MR).stroke();

    // 2. Top header
    doc.fillColor('#0000ff').fontSize(10).font('Helvetica')
      .text('GST : 24AANFE0044M1ZG', ML + 12, MR + 4, { lineBreak: false });
    doc.fillColor('#0000ff').fontSize(10).font('Helvetica-Bold')
      .text('|| Shree Ganeshay Namah ||', ML, MR + 4, { width: contentWidth, align: 'center', lineBreak: false });
    doc.fillColor('#0000ff').fontSize(10).font('Helvetica')
      .text('Mo. +91 99098 66667', ML, MR + 4, { width: contentWidth - 12, align: 'right', lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.5)
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
    doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold');
    const textWidth = doc.widthOfString(addressText);
    const startX = ML + (contentWidth - textWidth) / 2;
    drawMapPin(doc, startX - 8, MR + 70 + 7);
    doc.text(addressText, startX, MR + 70, { lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.8)
      .moveTo(ML, MR + 84).lineTo(PW - MR, MR + 84).stroke();

    // 3. Party & Challan Strip
    const startY = MR + 88;
    doc.fillColor('#0000ff').fontSize(11).font('Helvetica-Bold')
      .text('M/S:', ML + 10, startY + 5, { lineBreak: false });
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
      .text('VG CREATIONS (SURAT)', ML + 38, startY + 3.5, { lineBreak: false });

    doc.fillColor('#0000ff').fontSize(11).font('Helvetica-Bold')
      .text('DATE:', PW - MR - 225, startY + 5, { width: 45, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
      .text('17/10/2026', PW - MR - 175, startY + 5, { width: 75, align: 'left', lineBreak: false });

    doc.fillColor('#0000ff').fontSize(11).font('Helvetica-Bold')
      .text('CH. NO.:', PW - MR - 105, startY + 5, { width: 50, align: 'right', lineBreak: false });
    doc.fillColor('#dc2626').fontSize(13.5).font('Helvetica-Bold')
      .text('EDP-1244', PW - MR - 55, startY + 3.5, { width: 50, align: 'right', lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.6)
      .moveTo(ML, startY + 23).lineTo(PW - MR, startY + 23).stroke();

    // 4. Bill To & Ship To
    function renderField(label, value, x, y, width, height) {
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, y, width, height).stroke();
      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 6, y + 3, { width: width - 12, lineBreak: false });
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
        .text(String(value || '—'), x + 6, y + 14, { width: width - 12, lineBreak: false });
    }

    const billStartY = startY + 23;
    const halfWidth = contentWidth / 2;
    renderField('Bill to', 'VG CREATIONS PVT LTD, SURAT', ML, billStartY, halfWidth, 28);
    renderField('Ship to', 'SELF DRIVE (SURAT WAREHOUSE)', ML + halfWidth, billStartY, halfWidth, 28);

    let curY = billStartY + 33;

    doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica-Bold')
      .text(`JOB-WISE TP & ROLL BREAKDOWN (${Math.round(targetOpacity * 100)}% OPACITY DESIGN BACKGROUND)`, ML + 4, curY, { lineBreak: false });
    curY += 14;

    // Render each Job Card's TP section
    jobGroups.forEach((job) => {
      const tpHeaderH = 20;
      const tpRowH = 19;
      const bannerH = 26;
      const subtotalH = 20;
      const numRows = job.tps.length;
      const sectionH = bannerH + tpHeaderH + numRows * tpRowH + subtotalH;

      // ── DRAW BACKGROUND IMAGE WITH EXACT OPACITY (NO FULL WHITE RECTANGLE BLOCKING IT!) ──
      if (fs.existsSync(job.imagePath)) {
        doc.save();
        // Clip strictly inside this Job section box
        doc.rect(ML + 1, curY + 1, contentWidth - 2, sectionH - 2).clip();
        doc.opacity(targetOpacity); // Exactly targetOpacity (0.80 or 1.0)
        
        // Render image covering the right side / center background
        const bgImgW = 260;
        const bgImgH = sectionH + 20;
        const bgImgX = ML + contentWidth - bgImgW - 4;
        const bgImgY = curY - 10;
        
        try {
          doc.image(job.imagePath, bgImgX, bgImgY, {
            width: bgImgW,
            height: bgImgH,
            fit: [bgImgW, bgImgH],
            align: 'right',
            valign: 'center'
          });
        } catch (e) {}
        doc.restore();
      }

      // Outer section border
      doc.strokeColor('#0000ff').lineWidth(0.8).rect(ML, curY, contentWidth, sectionH).stroke();

      // 1. Job Header Banner (Solid white background for clear readability of job title)
      doc.rect(ML, curY, contentWidth, bannerH).fill('#ffffff');
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, contentWidth, bannerH).stroke();

      // Job Badge
      doc.rect(ML + 6, curY + 4, 90, 18).fill('#e0f2fe');
      doc.strokeColor('#0284c7').lineWidth(0.5).rect(ML + 6, curY + 4, 90, 18).stroke();
      doc.fillColor('#0369a1').fontSize(9).font('Helvetica-Bold')
         .text(job.jobNo, ML + 6, curY + 8, { width: 90, align: 'center' });

      // Design No
      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold').text('DESIGN:', ML + 106, curY + 9);
      doc.fillColor('#dc2626').fontSize(10).font('Helvetica-Bold').text(job.designNo, ML + 152, curY + 8);

      // Colour & Fabric
      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold').text('COLOUR:', ML + 275, curY + 9);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(job.colour, ML + 325, curY + 8);

      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold').text('LOT:', ML + 440, curY + 9);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(job.lotNo, ML + 465, curY + 8);

      let subY = curY + bannerH;

      // 2. Table Column Headers
      doc.rect(ML, subY, contentWidth, tpHeaderH).fill('#f8fafc');
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, subY, contentWidth, tpHeaderH).stroke();

      const cW = {
        tpNo: 70,
        lot: 80,
        fresh: 110,
        west: 110,
        total: 152
      };

      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold');
      let colX = ML;
      doc.text('TP NO.', colX, subY + 6, { width: cW.tpNo, align: 'center' });
      colX += cW.tpNo;
      doc.moveTo(colX, subY).lineTo(colX, subY + tpHeaderH).stroke();

      doc.text('LOT NO.', colX, subY + 6, { width: cW.lot, align: 'center' });
      colX += cW.lot;
      doc.moveTo(colX, subY).lineTo(colX, subY + tpHeaderH).stroke();

      doc.text('FRESH (mtr)', colX, subY + 6, { width: cW.fresh, align: 'center' });
      colX += cW.fresh;
      doc.moveTo(colX, subY).lineTo(colX, subY + tpHeaderH).stroke();

      doc.text('WEST (mtr)', colX, subY + 6, { width: cW.west, align: 'center' });
      colX += cW.west;
      doc.moveTo(colX, subY).lineTo(colX, subY + tpHeaderH).stroke();

      doc.text('TOTAL ROLL (mtr)', colX, subY + 6, { width: cW.total, align: 'center' });

      subY += tpHeaderH;

      // 3. Render TP Rows (Notice: NO FULL WHITE FILL that kills the background image! Image shines through!)
      let jobTotalFresh = 0;
      let jobTotalWest = 0;
      let jobTotalMtr = 0;

      job.tps.forEach((tp) => {
        jobTotalFresh += tp.fresh;
        jobTotalWest += tp.west;
        jobTotalMtr += tp.total;

        // Draw row border outline only (leaves background completely transparent so 80% / 100% image is fully visible!)
        doc.strokeColor('#0000ff').lineWidth(0.4).rect(ML, subY, contentWidth, tpRowH).stroke();

        let rx = ML;

        // Left 2 columns (TP No and Lot No) have solid white fill so roll number is super clear
        doc.rect(rx, subY, cW.tpNo + cW.lot, tpRowH).fill('#ffffff');
        doc.strokeColor('#0000ff').lineWidth(0.4).rect(rx, subY, cW.tpNo + cW.lot, tpRowH).stroke();

        // TP No
        doc.fillColor('#0000ff').fontSize(9).font('Helvetica-Bold')
           .text(`TP ${tp.tpNo}`, rx, subY + 5, { width: cW.tpNo, align: 'center' });
        rx += cW.tpNo;
        doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(rx, subY).lineTo(rx, subY + tpRowH).stroke();

        // Lot
        doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
           .text(job.lotNo, rx, subY + 5, { width: cW.lot, align: 'center' });
        rx += cW.lot;
        doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(rx, subY).lineTo(rx, subY + tpRowH).stroke();

        // Right 3 columns (Fresh, West, Total) sit DIRECTLY over the vibrant design image with crisp white pill tags!
        // Fresh pill
        doc.save();
        doc.rect(rx + cW.fresh - 78, subY + 2.5, 70, tpRowH - 5).fill('#ffffff');
        doc.strokeColor('#cbd5e1').lineWidth(0.3).rect(rx + cW.fresh - 78, subY + 2.5, 70, tpRowH - 5).stroke();
        doc.restore();
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
           .text(tp.fresh.toFixed(2) + ' m', rx, subY + 5, { width: cW.fresh - 12, align: 'right' });
        rx += cW.fresh;
        doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(rx, subY).lineTo(rx, subY + tpRowH).stroke();

        // West pill
        doc.save();
        doc.rect(rx + cW.west - 68, subY + 2.5, 60, tpRowH - 5).fill('#ffffff');
        doc.strokeColor('#fca5a5').lineWidth(0.3).rect(rx + cW.west - 68, subY + 2.5, 60, tpRowH - 5).stroke();
        doc.restore();
        doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold')
           .text(tp.west.toFixed(2) + ' m', rx, subY + 5, { width: cW.west - 12, align: 'right' });
        rx += cW.west;
        doc.strokeColor('#93c5fd').lineWidth(0.4).moveTo(rx, subY).lineTo(rx, subY + tpRowH).stroke();

        // Total Roll pill
        doc.save();
        doc.rect(rx + cW.total - 88, subY + 2, 80, tpRowH - 4).fill('#ffffff');
        doc.strokeColor('#0284c7').lineWidth(0.5).rect(rx + cW.total - 88, subY + 2, 80, tpRowH - 4).stroke();
        doc.restore();
        doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
           .text(tp.total.toFixed(2) + ' mtr', rx, subY + 5, { width: cW.total - 12, align: 'right' });

        subY += tpRowH;
      });

      // 4. Job Subtotal Row
      doc.rect(ML, subY, contentWidth, subtotalH).fill('#ffffff');
      doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML, subY, contentWidth, subtotalH).stroke();

      doc.fillColor('#0000ff').fontSize(8.5).font('Helvetica-Bold')
         .text(`SUBTOTAL FOR ${job.jobNo} (${job.tps.length} ROLLS):`, ML + 12, subY + 5.5);

      let stX = ML + cW.tpNo + cW.lot;
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
         .text(jobTotalFresh.toFixed(2) + ' m', stX, subY + 5.5, { width: cW.fresh - 12, align: 'right' });

      stX += cW.fresh;
      doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold')
         .text(jobTotalWest.toFixed(2) + ' m', stX, subY + 5.5, { width: cW.west - 12, align: 'right' });

      stX += cW.west;
      doc.fillColor('#10b981').fontSize(10).font('Helvetica-Bold')
         .text(jobTotalMtr.toFixed(2) + ' mtr', stX, subY + 5, { width: cW.total - 12, align: 'right' });

      curY += sectionH + 10;
    });

    // 6. Overall Combined Grand Totals Bar
    const summaryHalfW = contentWidth / 2;
    doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML, curY, summaryHalfW, 36).stroke();
    doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
       .text('TOTAL CHALLAN TP (ALL JOBS)', ML, curY + 5, { width: summaryHalfW, align: 'center' });
    doc.fillColor('#dc2626').fontSize(14).font('Helvetica-Bold')
       .text('7 ROLLS (2 + 5)', ML, curY + 18, { width: summaryHalfW, align: 'center' });

    doc.strokeColor('#0000ff').lineWidth(0.6).rect(ML + summaryHalfW, curY, summaryHalfW, 36).stroke();
    doc.fillColor('#0000ff').fontSize(9.5).font('Helvetica-Bold')
       .text('TOTAL CHALLAN DISPATCHED METRES', ML + summaryHalfW, curY + 5, { width: summaryHalfW, align: 'center' });
    doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold')
       .text('374.70 mtr', ML + summaryHalfW, curY + 18, { width: summaryHalfW, align: 'center' });

    curY += 44;

    // 7. Notes & Signatures
    doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, curY, contentWidth, 24).stroke();
    doc.fillColor('#0000ff').fontSize(8).font('Helvetica-Bold')
       .text('NOTES:', ML + 6, curY + 3);
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica')
       .text('Job #3311 (2 rolls = 102.5m) and Job #3312 (5 rolls = 272.2m) dispatched via Self Drive.', ML + 45, curY + 3, { width: contentWidth - 55 });
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
       .text('Total Pcs: 35 pcs | Total Jobs: 2 | Fresh: 366.6m | West: 8.1m', ML + 6, curY + 13);

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
      console.log(`Generated: ${outputFilePath} (Opacity: ${Math.round(targetOpacity * 100)}%)`);
      resolve();
    });
    stream.on('error', reject);
  });
}

(async () => {
  const file80 = path.join(__dirname, '../../../sample_challan_80_percent_opacity.pdf');
  const file100 = path.join(__dirname, '../../../sample_challan_100_percent_opacity.pdf');
  
  await generateChallanWithOpacity(0.80, file80);
  await generateChallanWithOpacity(1.00, file100);
  console.log('Both PDFs generated successfully!');
})();
