const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ─── Google Drive URL converter ───────────────────────────────────────────────
function convertDriveUrl(link) {
  if (!link || !link.trim()) return '';
  if (link.includes('lh3.googleusercontent.com/d/')) return link;
  const fileMatch = link.match(/\/d\/([-\w]{20,})/) || link.match(/[?&]id=([-\w]{20,})/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=s1000`;
  }
  if (link.includes('drive.google.com') || link.includes('googleusercontent') || link.includes('lh3.google')) {
    const idMatch = link.match(/([-\w]{25,})/);
    return idMatch ? `https://lh3.googleusercontent.com/d/${idMatch[1]}=s1000` : link;
  }
  return link;
}

// ─── Fetch image as Buffer for PDF embedding ──────────────────────────────────
async function getImageBuffer(url) {
  if (!url || !url.trim()) return null;
  try {
    if (url.startsWith('data:image/')) {
      return Buffer.from(url.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    }
    if (url.match(/^\/?uploads\//)) {
      const p = path.join(__dirname, '../../uploads', url.replace(/^\/?uploads\//, ''));
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    const designsMatch = url.match(/(?:^\/designs\/|\/designs\/)(.+)$/);
    if (designsMatch) {
      const p = path.join(__dirname, '../../../elite_edition_images', designsMatch[1]);
      if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const r = await axios.get(convertDriveUrl(url), {
        responseType: 'arraybuffer', timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return Buffer.from(r.data);
    }
    const up = path.join(__dirname, '../../uploads', url);
    if (fs.existsSync(up)) return fs.readFileSync(up);
    const dp = path.join(__dirname, '../../../elite_edition_images', url);
    if (fs.existsSync(dp)) return fs.readFileSync(dp);
  } catch (e) {
    logger.warn('getImageBuffer failed for "%s": %s', url, e.message);
  }
  return null;
}

// ─── Speed tables ─────────────────────────────────────────────────────────────
const SPEED_GRANDO = {
  36:{1:281,2:168,4:101,6:67,8:50}, 38:{1:266,2:160,4:96,6:64,8:48},
  42:{1:240,2:144,4:86,6:58,8:43}, 44:{1:230,2:138,4:82,6:55,8:41},
  46:{1:220,2:132,4:79,6:53,8:39}, 58:{1:174,2:104,4:62,6:41,8:31},
};
const SPEED_PRINTDOT = {
  36:{1:841,2:503,4:299,6:198,8:150}, 38:{1:797,2:476,4:284,6:188,8:142},
  42:{1:721,2:431,4:257,6:170,8:129}, 44:{1:688,2:411,4:245,6:162,8:123},
  46:{1:658,2:393,4:234,6:155,8:117}, 58:{1:522,2:312,4:186,6:123,8:93},
};

function calcExpTime(panna, passText, totalMtr, machineName) {
  const pannaNum = Number((String(panna||'').match(/\d+/)||[])[0]);
  const pass     = Number((String(passText||'').match(/\d+/)||[])[0]);
  if (!pannaNum || !pass || !totalMtr) return '';
  const mName = String(machineName||'').trim().toUpperCase();
  const table = mName==='GRANDO' ? SPEED_GRANDO : mName==='PRINTDOT' ? SPEED_PRINTDOT : null;
  if (!table || !table[pannaNum] || !table[pannaNum][pass]) return '';
  const speed = table[pannaNum][pass];
  const time  = Number(totalMtr) / speed;
  let h = Math.floor(time);
  let m = Math.round((time - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${h}H & ${m}M`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
const getAllJobCards = async (req, res) => {
  try {
    const { status, search, page=1, limit=50, dateStart, dateEnd, sortBy, sortOrder, category, department } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (category && category !== 'All') filter.category = category;

    let deptOr = null;
    if (department === 'stitching') {
      deptOr = [
        { department: 'stitching' },
        { category: { $regex: 'stitching', $options: 'i' } }
      ];
    } else if (department === 'digital_print') {
      filter.department = { $ne: 'stitching' };
      filter.category = { $ne: 'Stitching' };
    }

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd)   filter.date.$lte = dateEnd;
    }

    if (search) {
      const trimmed = search.trim();
      const digitsOnly = trimmed.replace(/\D/g, '');
      const searchRegex = { $regex: trimmed, $options: 'i' };
      
      const searchOr = [
        { jobNo:       searchRegex },
        { party:       searchRegex },
        { designNo:    searchRegex },
        { machineName: searchRegex },
        { billNo:      searchRegex },
        { partyChallan: searchRegex },
        { ourChallanNo: searchRegex },
        { lotNo:       searchRegex },
        { fabric:      searchRegex },
      ];

      if (digitsOnly) {
        const digitRegex = { $regex: digitsOnly, $options: 'i' };
        searchOr.push(
          { jobNo: digitRegex },
          { billNo: digitRegex },
          { partyChallan: digitRegex },
          { ourChallanNo: digitRegex }
        );
      }

      if (deptOr) {
        filter.$and = [{ $or: deptOr }, { $or: searchOr }];
      } else {
        filter.$or = searchOr;
      }
    } else if (deptOr) {
      filter.$or = deptOr;
    }
    const skip  = (Number(page)-1) * Number(limit);
    const total = await db.JobCard.countDocuments(filter);

    let cards;
    if (sortBy === 'urgency') {
      cards = await db.JobCard.aggregate([
        { $match: filter },
        { $addFields: {
            statusScore:    { $cond: [{ $eq: ['$status','Pending'] }, 100, { $cond: [{ $eq: ['$status','In Progress'] }, 50, 0] }] },
            emergencyScore: { $cond: [{ $and: ['$emergencyNotes', { $ne: ['$emergencyNotes',''] }] }, 200, 0] },
            dateParsed:     { $cond: [{ $and: ['$date', { $ne: ['$date',''] }] }, { $dateFromString: { dateString: '$date' } }, new Date()] }
        }},
        { $addFields: { ageDays: { $divide: [{ $subtract: [new Date(), '$dateParsed'] }, 86400000] } } },
        { $addFields: { urgencyScore: { $add: ['$statusScore','$emergencyScore',{ $multiply: ['$ageDays',10] }] } } },
        { $sort: { urgencyScore: -1, created_date_time: -1 } },
        { $skip: skip }, { $limit: Number(limit) }
      ]);
    } else if (!sortBy || sortBy === 'jobNo') {
      const order = sortOrder === 'desc' ? -1 : 1;
      cards = await db.JobCard.aggregate([
        { $match: filter },
        {
          $addFields: {
            jobNoNum: {
              $convert: {
                input: {
                  $let: {
                    vars: {
                      matchObj: { $regexFind: { input: "$jobNo", regex: "\\d+" } }
                    },
                    in: "$$matchObj.match"
                  }
                },
                to: "int",
                onError: 0,
                onNull: 0
              }
            }
          }
        },
        { $sort: { jobNoNum: order } },
        { $skip: skip },
        { $limit: Number(limit) }
      ]);
    } else {
      const order = sortOrder === 'desc' ? -1 : 1;
      const sort = { [sortBy]: order };
      cards = await db.JobCard.find(filter)
        .collation({ locale:'en', numericOrdering:true })
        .sort(sort).skip(skip).limit(Number(limit)).lean();
    }
    res.json({ data: cards, total, page: Number(page), pages: Math.ceil(total/Number(limit)) });
  } catch (err) {
    logger.error('getAllJobCards error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getJobCard = async (req, res) => {
  try {
    const card = await db.JobCard.findById(req.params.id).lean();
    if (!card) return res.status(404).json({ error: 'Job card not found' });
    res.json(card);
  } catch (err) { res.status(500).json({ error: 'Internal Server Error' }); }
};

function normalizeDateStr(dtStr) {
  if (!dtStr || typeof dtStr !== 'string' || !dtStr.trim()) return '';
  const s = dtStr.trim();
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const day   = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year  = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year  = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day   = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
}

const syncDesignImage = async (body, existingCard = null) => {
  const dName = body.designName || body.designNo || (existingCard ? (existingCard.designName || existingCard.designNo) : '');
  if (dName) {
    const cleanName = String(dName).trim().replace(/^ED-/i, '');
    try {
      const designDoc = await db.Design.findOne({
        $or: [
          { designName: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { designNo: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        ]
      }).lean();
      if (designDoc && (designDoc.imageUrl || designDoc.imageUrl2)) {
        body.imageUrl1 = designDoc.imageUrl || designDoc.imageUrl2;
      }
    } catch (e) {}
  }
};

const createJobCard = async (req, res) => {
  try {
    const body = req.body;
    if (!body.createdBy) {
      body.createdBy = req.user?.name || req.user?.username || 'Admin';
    }
    if (body.date) body.date = normalizeDateStr(body.date);
    if (body.printDate) body.printDate = normalizeDateStr(body.printDate);
    if (body.fusingDate) body.fusingDate = normalizeDateStr(body.fusingDate);
    if (body.deliveryDate) body.deliveryDate = normalizeDateStr(body.deliveryDate);

    await syncDesignImage(body);

    if (body.panna && body.pass && body.totalMtr && body.machineName)
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);
    const card = await db.JobCard.create(body);
    res.status(201).json(card);
  } catch (err) {
    logger.error('createJobCard error: %o', err);
    if (err.code === 11000) return res.status(400).json({ error: `Job No. "${req.body.jobNo}" already exists.` });
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const updateJobCard = async (req, res) => {
  try {
    const body = req.body;
    if (body.date) body.date = normalizeDateStr(body.date);
    if (body.printDate) body.printDate = normalizeDateStr(body.printDate);
    if (body.fusingDate) body.fusingDate = normalizeDateStr(body.fusingDate);
    if (body.deliveryDate) body.deliveryDate = normalizeDateStr(body.deliveryDate);

    const existingCard = await db.JobCard.findById(req.params.id);
    if (!existingCard) return res.status(404).json({ error: 'Job card not found' });

    await syncDesignImage(body, existingCard);

    if (body.panna && body.pass && body.totalMtr && body.machineName)
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);

    const printStatus    = body.printStatus    !== undefined ? body.printStatus    : existingCard.printStatus;
    const fusingStatus   = body.fusingStatus   !== undefined ? body.fusingStatus   : existingCard.fusingStatus;
    const deliveryStatus = body.deliveryStatus !== undefined ? body.deliveryStatus : existingCard.deliveryStatus;
    if (body.printStatus    === 'Printing Done'  && !body.printDate    && !existingCard.printDate)    body.printDate    = new Date().toISOString().split('T')[0];
    if (body.fusingStatus   === 'Fusing Done'    && !body.fusingDate   && !existingCard.fusingDate)   body.fusingDate   = new Date().toISOString().split('T')[0];
    if (body.deliveryStatus === 'Delivery Done'  && !body.deliveryDate && !existingCard.deliveryDate) body.deliveryDate = new Date().toISOString().split('T')[0];
    if (printStatus==='Printing Done' && fusingStatus==='Fusing Done' && deliveryStatus==='Delivery Done') body.status='Done';
    else if (printStatus==='Printing Done' || fusingStatus==='Fusing Done' || deliveryStatus==='Delivery Done') body.status='In Progress';
    else body.status='Pending';
    const card = await db.JobCard.findByIdAndUpdate(req.params.id, body, { new:true, runValidators:true }).lean();
    res.json(card);
  } catch (err) {
    logger.error('updateJobCard error: %o', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const deleteJobCard = async (req, res) => {
  try {
    const card = await db.JobCard.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ error: 'Job card not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: 'Internal Server Error' }); }
};

const calcExpTimeEndpoint = async (req, res) => {
  const { panna, pass, totalMtr, machineName } = req.query;
  res.json({ expTime: calcExpTime(panna, pass, totalMtr, machineName) });
};

const getNextJobCardNumber = async (req, res) => {
  try {
    const config    = await db.PrintConfig.findOne({ isConfig: true });
    const startingNo = config && config.startingJobNo ? config.startingJobNo : 1;
    const cards     = await db.JobCard.find({}, { jobNo: 1 }).lean();
    let maxNo = startingNo - 1;
    cards.forEach(c => {
      if (!c.jobNo) return;
      const num = Number(c.jobNo);
      if (!isNaN(num)) { if (num > maxNo) maxNo = num; }
      else {
        const m = String(c.jobNo).match(/(\d+)/);
        if (m) { const p=Number(m[1]); if (!isNaN(p) && p>maxNo) maxNo=p; }
      }
    });
    res.json({ nextJobNo: `JOB NO.- ${maxNo+1}` });
  } catch (err) {
    logger.error('getNextJobCardNumber error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── PDF Generator (Physical A5 Layout) ─────────────────────────────────────────
const downloadJobCardPdf = async (req, res) => {
  try {
    const jobCard = await db.JobCard.findById(req.params.id).lean();
    if (!jobCard) return res.status(404).json({ error: 'Job Card not found' });

    let imageUrl1 = '';
    let imageUrl2 = '';

    function extractNames(str) {
      if (!str || typeof str !== 'string') return [];
      return str.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
    }

    const keyStr = jobCard.designName || jobCard.designNo || '';
    const names = extractNames(keyStr);

    if (names[0]) {
      const cleanName = names[0].replace(/^ED-/i, '');
      const design1 = await db.Design.findOne({
        $or: [
          { designName: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { designNo: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        ]
      }).lean();
      if (design1 && (design1.imageUrl || design1.imageUrl2)) {
        imageUrl1 = design1.imageUrl || design1.imageUrl2;
      }
    }
    if (!imageUrl1) imageUrl1 = jobCard.imageUrl1 || '';

    if (names.length >= 2 && names[1]) {
      const cleanName2 = names[1].replace(/^ED-/i, '');
      const design2 = await db.Design.findOne({
        $or: [
          { designName: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { designNo: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        ]
      }).lean();
      if (design2) imageUrl2 = design2.imageUrl || design2.imageUrl2 || '';
      if (!imageUrl2) imageUrl2 = jobCard.imageUrl2 || '';
    }

    const [imgBuf1, imgBuf2] = await Promise.all([getImageBuffer(imageUrl1), getImageBuffer(imageUrl2)]);

    // ── PDF Creation (A5 Size) ──
    const doc = new PDFDocument({ margin: 0, size: 'A5', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="JobCard_${jobCard.jobNo || 'preview'}.pdf"`);
    doc.pipe(res);

    const PW = 419.53, PH = 595.28;
    const ML = 35; // Left margin with room for Punch guide
    const MR = 12;
    const CW = PW - ML - MR; // ~372.5 pt

    // ── 1. PUNCH HOLE GUIDE (Left Margin) ──
    const punchX = 14;
    doc.circle(punchX, 140, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();
    const centerY = PH / 2;
    doc.moveTo(8, centerY).lineTo(20, centerY).strokeColor('#9ca3af').lineWidth(1.2).stroke();
    doc.fillColor('#9ca3af').fontSize(5).font('Helvetica-Bold')
      .text('PUNCH', 4, centerY + 4, { width: 20, align: 'center' });
    doc.circle(punchX, 450, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();

    // ── 2. HEADER BOX ──
    let curY = 12;
    const headerH = 38;
    doc.rect(ML, curY, CW, headerH).strokeColor('#000000').lineWidth(1.5).stroke();

    const logoPath = path.join(__dirname, 'DigitalLogo.png');
    const logoFallback = path.join(__dirname, 'Logo.png');
    const activeLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(logoFallback) ? logoFallback : null);

    const logoW = 85, logoH = 30;
    if (activeLogo) {
      try {
        doc.image(activeLogo, ML + 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
        doc.image(activeLogo, ML + CW - logoW - 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
      } catch (e) {}
    }

    doc.moveTo(ML + logoW + 10, curY).lineTo(ML + logoW + 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();
    doc.moveTo(ML + CW - logoW - 10, curY).lineTo(ML + CW - logoW - 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('ELITE DIGITAL', ML + logoW + 10, curY + 3, { width: CW - 2 * (logoW + 10), align: 'center' });

    const mName = (jobCard.machineName || '').trim().toUpperCase();
    const mBg = mName === 'GRANDO' ? '#0b5394' : mName === 'PRINTDOT' ? '#cc0000' : '#ffffff';
    const mColor = mName ? '#ffffff' : '#000000';
    const badgeW = 100, badgeH = 13, badgeX = ML + (CW - badgeW) / 2;
    doc.rect(badgeX, curY + 22, badgeW, badgeH).fillAndStroke(mBg, '#000000');
    doc.fillColor(mColor).fontSize(8.5).font('Helvetica-Bold')
      .text(mName || ' ', badgeX, curY + 24, { width: badgeW, align: 'center' });

    curY += headerH + 1;

    // ── 3. MAIN FIELDS GRID TABLE ──
    const colW_Label = 42;
    const colW_Val = (CW - 3 * colW_Label) / 3; // ~82 pt
    const rowH = 15;

    const formatDateStr = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '';

    const gridRows = [
      [['JOB NO. :', jobCard.jobNo || ''], ['COLORS :', jobCard.colors || ''], ['DATE :', formatDateStr(jobCard.date)]],
      [['D. NO. :', jobCard.designNo || jobCard.designName || ''], ['PANNA :', jobCard.panna || ''], ['PASS :', jobCard.pass || '']],
      [['FABRIC :', jobCard.fabric || ''], ['CON. :', jobCard.consumption || ''], ['ALL OVER :', jobCard.allover || '']],
      [['PCS :', jobCard.pcs || ''], ['BOTTOM :', jobCard.bottom || ''], ['PN/KM :', jobCard.pnKm || '']],
      [['TOP :', jobCard.top || ''], ['DUPATTA :', jobCard.dupatta || ''], ['SET-COPY :', jobCard.setCopy || '']],
    ];

    gridRows.forEach(row => {
      let x = ML;
      row.forEach(([lbl, val]) => {
        doc.rect(x, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
          .text(lbl, x + 2, curY + 3.5, { width: colW_Label - 4, lineBreak: false });
        x += colW_Label;

        doc.rect(x, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(8).font('Helvetica')
          .text(String(val), x + 3, curY + 3.5, { width: colW_Val - 5, lineBreak: false });
        x += colW_Val;
      });
      curY += rowH;
    });

    // Row 6: SLEEVE, CUT, TOTAL MTR Header
    let x6 = ML;
    doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('SLEEVE :', x6 + 2, curY + 3.5);
    x6 += colW_Label;
    doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(8).font('Helvetica').text(String(jobCard.sleeve || ''), x6 + 3, curY + 3.5);
    x6 += colW_Val;

    doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('CUT :', x6 + 2, curY + 3.5);
    x6 += colW_Label;
    doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(8).font('Helvetica').text(String(jobCard.cut || ''), x6 + 3, curY + 3.5);
    x6 += colW_Val;

    const totalHeaderW = colW_Label + colW_Val;
    doc.rect(x6, curY, totalHeaderW, rowH).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text('TOTAL MTR', x6, curY + 3.5, { width: totalHeaderW, align: 'center' });
    curY += rowH;

    // Row 7: PARTY and TOTAL MTR Value
    let x7 = ML;
    doc.rect(x7, curY, colW_Label, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('PARTY :', x7 + 2, curY + 4.5);
    x7 += colW_Label;

    const partyValW = 2 * colW_Val + colW_Label;
    doc.rect(x7, curY, partyValW, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text(String(jobCard.party || ''), x7 + 3, curY + 4.5);
    x7 += partyValW;

    doc.rect(x7, curY, totalHeaderW, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text(`: ${jobCard.totalMtr || ''}`, x7 + 4, curY + 3);
    curY += rowH + 3;

    // ── 4. DESIGN IMAGE CONTAINER ──
    const imgAreaH = 135;
    doc.rect(ML, curY, CW, imgAreaH).strokeColor('#000000').lineWidth(1.2).stroke();

    try {
      if (imgBuf1 && imgBuf2) {
        const halfW = CW / 2;
        doc.moveTo(ML + halfW, curY).lineTo(ML + halfW, curY + imgAreaH).strokeColor('#000000').lineWidth(1).stroke();
        doc.image(imgBuf1, ML + 3, curY + 3, { fit: [halfW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
        doc.image(imgBuf2, ML + halfW + 3, curY + 3, { fit: [halfW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
      } else if (imgBuf1) {
        doc.image(imgBuf1, ML + 3, curY + 3, { fit: [CW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
      } else if (imgBuf2) {
        doc.image(imgBuf2, ML + 3, curY + 3, { fit: [CW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
      } else {
        doc.fillColor('#cccccc').fontSize(11).font('Helvetica-Bold')
          .text('NO DESIGN IMAGE', ML, curY + imgAreaH / 2 - 6, { width: CW, align: 'center' });
      }
    } catch (e) {
      doc.fillColor('#cccccc').fontSize(11).font('Helvetica-Bold')
        .text('NO DESIGN IMAGE', ML, curY + imgAreaH / 2 - 6, { width: CW, align: 'center' });
    }

    curY += imgAreaH + 1;

    // ── 5. NOTES CONTAINER ──
    if (jobCard.emergencyNotes || jobCard.note1 || jobCard.note2) {
      const notesList = [];
      if (jobCard.emergencyNotes) notesList.push({ type: 'emergency', text: `⚠ EMERGENCY: ${jobCard.emergencyNotes}` });
      if (jobCard.note1) notesList.push({ type: 'normal', text: `NOTE 1: ${jobCard.note1}` });
      if (jobCard.note2) notesList.push({ type: 'normal', text: `NOTE 2: ${jobCard.note2}` });

      notesList.forEach(n => {
        const noteH = 16;
        const bg = n.type === 'emergency' ? '#fee2e2' : '#f3f4f6';
        doc.rect(ML, curY, CW, noteH).fillAndStroke(bg, '#000000');
        doc.fillColor(n.type === 'emergency' ? '#dc2626' : '#000000')
          .fontSize(8).font('Helvetica-Bold')
          .text(n.text, ML + 5, curY + 3.5, { width: CW - 10, lineBreak: false });
        curY += noteH;
      });
      curY += 1;
    }

    // ── 6. T.P. METER & PROCESS DETAILS TABLE ──
    doc.rect(ML, curY, CW, 14).strokeColor('#000000').lineWidth(1).stroke();
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
      .text('PROCESS & T.P. DETAILS', ML, curY + 3, { width: CW, align: 'center' });
    curY += 14;

    const tpColLabelW = 55;
    const tpColValW = (CW - 2 * tpColLabelW) / 2; // ~131 pt
    const tpRowH = 14;

    const tpRows = [
      [['EXP. TIME :', jobCard.expTime || ''], ['PRINT DATE :', formatDateStr(jobCard.printDate)]],
      [['FUSING DATE :', formatDateStr(jobCard.fusingDate)], ['PAPER TYPE :', jobCard.paperType || '']],
      [['FUSING TEMP :', jobCard.temperature || ''], ['SPEED :', jobCard.speed || '']],
      [['PROFILE :', jobCard.profile || ''], ['DESIGNER :', jobCard.designer || '']],
      [['C. MATCHING :', jobCard.colourMatching || ''], ['BILL NO. :', jobCard.billNo || '']],
    ];

    tpRows.forEach(row => {
      let tx = ML;
      row.forEach(([lbl, val]) => {
        doc.rect(tx, curY, tpColLabelW, tpRowH).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold')
          .text(lbl, tx + 2, curY + 3, { width: tpColLabelW - 4, lineBreak: false });
        tx += tpColLabelW;

        doc.rect(tx, curY, tpColValW, tpRowH).strokeColor('#000000').lineWidth(1).stroke();
        doc.fillColor('#000000').fontSize(7.5).font('Helvetica')
          .text(String(val), tx + 3, curY + 3, { width: tpColValW - 5, lineBreak: false });
        tx += tpColValW;
      });
      curY += tpRowH;
    });

    doc.end();
  } catch (err) {
    logger.error('downloadJobCardPdf error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

const downloadBulkJobCardsPdf = async (req, res) => {
  try {
    let ids = [];
    if (req.query.ids) {
      ids = String(req.query.ids).split(',').map(s => s.trim()).filter(Boolean);
    } else if (req.body && Array.isArray(req.body.ids)) {
      ids = req.body.ids;
    }

    if (ids.length === 0) {
      return res.status(400).send('No Job Card IDs provided.');
    }

    const jobCards = await db.JobCard.find({ _id: { $in: ids } }).sort({ created_date_time: -1 }).lean();
    if (jobCards.length === 0) {
      return res.status(404).send('No matching Job Cards found.');
    }

    const doc = new PDFDocument({ margin: 0, size: 'A5', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Combined_Job_Cards_${jobCards.length}_Cards.pdf"`);
    doc.pipe(res);

    const PW = 419.53, PH = 595.28;
    const ML = 35;
    const MR = 12;
    const CW = PW - ML - MR;

    const punchX = 14;
    const centerY = PH / 2;
    const colW_Label = 42;
    const colW_Val = (CW - 3 * colW_Label) / 3;
    const rowH = 15;
    const formatDateStr = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '';

    const logoPath = path.join(__dirname, 'DigitalLogo.png');
    const logoFallback = path.join(__dirname, 'Logo.png');
    const activeLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(logoFallback) ? logoFallback : null);

    function extractNames(str) {
      if (!str || typeof str !== 'string') return [];
      return str.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
    }

    for (let jIdx = 0; jIdx < jobCards.length; jIdx++) {
      const jobCard = jobCards[jIdx];
      if (jIdx > 0) doc.addPage({ size: 'A5', margin: 0 });

      let imageUrl1 = '';
      let imageUrl2 = '';
      const keyStr = jobCard.designName || jobCard.designNo || '';
      const names = extractNames(keyStr);

      if (names[0]) {
        const cleanName = names[0].replace(/^ED-/i, '');
        const design1 = await db.Design.findOne({
          $or: [
            { designName: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { designNo: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
          ]
        }).lean();
        if (design1 && (design1.imageUrl || design1.imageUrl2)) {
          imageUrl1 = design1.imageUrl || design1.imageUrl2;
        }
      }
      if (!imageUrl1) imageUrl1 = jobCard.imageUrl1 || '';

      if (names.length >= 2 && names[1]) {
        const cleanName2 = names[1].replace(/^ED-/i, '');
        const design2 = await db.Design.findOne({
          $or: [
            { designName: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { designNo: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
          ]
        }).lean();
        if (design2) imageUrl2 = design2.imageUrl || design2.imageUrl2 || '';
        if (!imageUrl2) imageUrl2 = jobCard.imageUrl2 || '';
      }

      const [imgBuf1, imgBuf2] = await Promise.all([getImageBuffer(imageUrl1), getImageBuffer(imageUrl2)]);

      doc.circle(punchX, 140, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();
      doc.moveTo(8, centerY).lineTo(20, centerY).strokeColor('#9ca3af').lineWidth(1.2).stroke();
      doc.fillColor('#9ca3af').fontSize(5).font('Helvetica-Bold')
        .text('PUNCH', 4, centerY + 4, { width: 20, align: 'center' });
      doc.circle(punchX, 450, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();

      let curY = 12;
      const headerH = 38;
      doc.rect(ML, curY, CW, headerH).strokeColor('#000000').lineWidth(1.5).stroke();

      const logoW = 85, logoH = 30;
      if (activeLogo) {
        try {
          doc.image(activeLogo, ML + 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
          doc.image(activeLogo, ML + CW - logoW - 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
        } catch (e) {}
      }

      doc.moveTo(ML + logoW + 10, curY).lineTo(ML + logoW + 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();
      doc.moveTo(ML + CW - logoW - 10, curY).lineTo(ML + CW - logoW - 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();

      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
        .text('ELITE DIGITAL', ML + logoW + 10, curY + 3, { width: CW - 2 * (logoW + 10), align: 'center' });

      const mName = (jobCard.machineName || '').trim().toUpperCase();
      const mBg = mName === 'GRANDO' ? '#0b5394' : mName === 'PRINTDOT' ? '#cc0000' : '#ffffff';
      const mColor = mName ? '#ffffff' : '#000000';
      const badgeW = 100, badgeH = 13, badgeX = ML + (CW - badgeW) / 2;
      doc.rect(badgeX, curY + 22, badgeW, badgeH).fillAndStroke(mBg, '#000000');
      doc.fillColor(mColor).fontSize(8.5).font('Helvetica-Bold')
        .text(mName || ' ', badgeX, curY + 24, { width: badgeW, align: 'center' });

      curY += headerH + 1;

      const gridRows = [
        [['JOB NO. :', jobCard.jobNo || ''], ['COLORS :', jobCard.colors || ''], ['DATE :', formatDateStr(jobCard.date)]],
        [['D. NO. :', jobCard.designNo || jobCard.designName || ''], ['PANNA :', jobCard.panna || ''], ['PASS :', jobCard.pass || '']],
        [['FABRIC :', jobCard.fabric || ''], ['CON. :', jobCard.consumption || ''], ['ALL OVER :', jobCard.allover || '']],
        [['PCS :', jobCard.pcs || ''], ['BOTTOM :', jobCard.bottom || ''], ['PN/KM :', jobCard.pnKm || '']],
        [['TOP :', jobCard.top || ''], ['DUPATTA :', jobCard.dupatta || ''], ['SET-COPY :', jobCard.setCopy || '']],
      ];

      gridRows.forEach(row => {
        let x = ML;
        row.forEach(([lbl, val]) => {
          doc.rect(x, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
          doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
            .text(lbl, x + 2, curY + 3.5, { width: colW_Label - 4, lineBreak: false });
          x += colW_Label;

          doc.rect(x, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
          doc.fillColor('#000000').fontSize(8).font('Helvetica')
            .text(String(val), x + 3, curY + 3.5, { width: colW_Val - 5, lineBreak: false });
          x += colW_Val;
        });
        curY += rowH;
      });

      let x6 = ML;
      doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('SLEEVE :', x6 + 2, curY + 3.5);
      x6 += colW_Label;
      doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8).font('Helvetica').text(String(jobCard.sleeve || ''), x6 + 3, curY + 3.5);
      x6 += colW_Val;

      doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('CUT :', x6 + 2, curY + 3.5);
      x6 += colW_Label;
      doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8).font('Helvetica').text(String(jobCard.cut || ''), x6 + 3, curY + 3.5);
      x6 += colW_Val;

      const totalHeaderW = colW_Label + colW_Val;
      doc.rect(x6, curY, totalHeaderW, rowH).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text('TOTAL MTR', x6, curY + 3.5, { width: totalHeaderW, align: 'center' });
      curY += rowH;

      let x7 = ML;
      doc.rect(x7, curY, colW_Label, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('PARTY :', x7 + 2, curY + 4.5);
      x7 += colW_Label;

      const partyValW = 2 * colW_Val + colW_Label;
      doc.rect(x7, curY, partyValW, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text(String(jobCard.party || ''), x7 + 3, curY + 4.5);
      x7 += partyValW;

      doc.rect(x7, curY, totalHeaderW, rowH + 2).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text(`: ${jobCard.totalMtr || ''}`, x7 + 4, curY + 3);
      curY += rowH + 3;

      const imgAreaH = 135;
      doc.rect(ML, curY, CW, imgAreaH).strokeColor('#000000').lineWidth(1.2).stroke();

      try {
        if (imgBuf1 && imgBuf2) {
          const halfW = CW / 2;
          doc.moveTo(ML + halfW, curY).lineTo(ML + halfW, curY + imgAreaH).strokeColor('#000000').lineWidth(1).stroke();
          doc.image(imgBuf1, ML + 3, curY + 3, { fit: [halfW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
          doc.image(imgBuf2, ML + halfW + 3, curY + 3, { fit: [halfW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
        } else if (imgBuf1) {
          doc.image(imgBuf1, ML + 3, curY + 3, { fit: [CW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
        } else if (imgBuf2) {
          doc.image(imgBuf2, ML + 3, curY + 3, { fit: [CW - 6, imgAreaH - 6], align: 'center', valignment: 'center' });
        } else {
          doc.fillColor('#cccccc').fontSize(11).font('Helvetica-Bold')
            .text('NO DESIGN IMAGE', ML, curY + imgAreaH / 2 - 6, { width: CW, align: 'center' });
        }
      } catch (e) {
        doc.fillColor('#cccccc').fontSize(11).font('Helvetica-Bold')
          .text('NO DESIGN IMAGE', ML, curY + imgAreaH / 2 - 6, { width: CW, align: 'center' });
      }

      curY += imgAreaH + 1;

      if (jobCard.emergencyNotes || jobCard.note1 || jobCard.note2) {
        const notesList = [];
        if (jobCard.emergencyNotes) notesList.push({ type: 'emergency', text: `⚠ EMERGENCY: ${jobCard.emergencyNotes}` });
        if (jobCard.note1) notesList.push({ type: 'normal', text: `NOTE 1: ${jobCard.note1}` });
        if (jobCard.note2) notesList.push({ type: 'normal', text: `NOTE 2: ${jobCard.note2}` });

        notesList.forEach(n => {
          const noteH = 16;
          const bg = n.type === 'emergency' ? '#fee2e2' : '#f3f4f6';
          doc.rect(ML, curY, CW, noteH).fillAndStroke(bg, '#000000');
          doc.fillColor(n.type === 'emergency' ? '#dc2626' : '#000000')
            .fontSize(8).font('Helvetica-Bold')
            .text(n.text, ML + 5, curY + 3.5, { width: CW - 10, lineBreak: false });
          curY += noteH;
        });
        curY += 1;
      }

      doc.rect(ML, curY, CW, 14).strokeColor('#000000').lineWidth(1).stroke();
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
        .text('PROCESS & T.P. DETAILS', ML, curY + 3, { width: CW, align: 'center' });
      curY += 14;

      const tpColLabelW = 55;
      const tpColValW = (CW - 2 * tpColLabelW) / 2;
      const tpRowH = 14;

      const tpRows = [
        [['EXP. TIME :', jobCard.expTime || ''], ['PRINT DATE :', formatDateStr(jobCard.printDate)]],
        [['FUSING DATE :', formatDateStr(jobCard.fusingDate)], ['PAPER TYPE :', jobCard.paperType || '']],
        [['FUSING TEMP :', jobCard.temperature || ''], ['SPEED :', jobCard.speed || '']],
        [['PROFILE :', jobCard.profile || ''], ['DESIGNER :', jobCard.designer || '']],
        [['C. MATCHING :', jobCard.colourMatching || ''], ['BILL NO. :', jobCard.billNo || '']],
      ];

      tpRows.forEach(row => {
        let tx = ML;
        row.forEach(([lbl, val]) => {
          doc.rect(tx, curY, tpColLabelW, tpRowH).strokeColor('#000000').lineWidth(1).stroke();
          doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold')
            .text(lbl, tx + 2, curY + 3, { width: tpColLabelW - 4, lineBreak: false });
          tx += tpColLabelW;

          doc.rect(tx, curY, tpColValW, tpRowH).strokeColor('#000000').lineWidth(1).stroke();
          doc.fillColor('#000000').fontSize(7.5).font('Helvetica')
            .text(String(val), tx + 3, curY + 3, { width: tpColValW - 5, lineBreak: false });
          tx += tpColValW;
        });
        curY += tpRowH;
      });
    }

    doc.end();
  } catch (err) {
    logger.error('downloadBulkJobCardsPdf error: %o', err);
    if (!res.headersSent) res.status(500).send('Error generating bulk Job Cards PDF');
  }
};

// ─── Module 1: Dynamic Custom Calculator Endpoint ──────────────────────────────
const calculatePrintCost = async (req, res) => {
  try {
    const {
      width = 0,
      height = 0,
      unit = 'inch', // 'inch' or 'ft'
      materialType = 'Sublimation',
      resolutionPass = '4 Pass',
      wastageFactorPct = 5,
      quantity = 1
    } = req.body;

    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    const qty = parseInt(quantity) || 1;
    const wastage = parseFloat(wastageFactorPct) || 0;

    // Convert dimensions to feet
    const widthFt = unit === 'inch' ? w / 12 : w;
    const heightFt = unit === 'inch' ? h / 12 : h;

    const baseSqFtPerUnit = widthFt * heightFt;
    const rawTotalSqFt = baseSqFtPerUnit * qty;

    const wastageSqFt = rawTotalSqFt * (wastage / 100);
    const billableSqFt = parseFloat((rawTotalSqFt + wastageSqFt).toFixed(2));
    const billableSqMtr = parseFloat((billableSqFt * 0.092903).toFixed(2));

    // Base rates per Sq. Ft (INR) by material
    const MATERIAL_RATES = {
      Sublimation: 45,
      Cotton: 85,
      Vinyl: 65,
      Satin: 55,
      Silk: 120,
      Polyester: 40
    };

    // Pass multiplier
    const PASS_MULTIPLIER = {
      '1 Pass': 1.0,
      '2 Pass': 1.1,
      '4 Pass': 1.25,
      '6 Pass': 1.4,
      '8 Pass': 1.6
    };

    const baseRate = MATERIAL_RATES[materialType] || 45;
    const passMult = PASS_MULTIPLIER[resolutionPass] || 1.25;
    const ratePerSqFt = parseFloat((baseRate * passMult).toFixed(2));

    const totalCalculatedCost = Math.round(billableSqFt * ratePerSqFt);
    const costPerUnit = qty > 0 ? Math.round(totalCalculatedCost / qty) : totalCalculatedCost;

    res.json({
      success: true,
      data: {
        widthFt: parseFloat(widthFt.toFixed(2)),
        heightFt: parseFloat(heightFt.toFixed(2)),
        baseSqFtPerUnit: parseFloat(baseSqFtPerUnit.toFixed(2)),
        rawTotalSqFt: parseFloat(rawTotalSqFt.toFixed(2)),
        wastageSqFt: parseFloat(wastageSqFt.toFixed(2)),
        billableSqFt,
        billableSqMtr,
        ratePerSqFt,
        totalCalculatedCost,
        costPerUnit
      }
    });
  } catch (err) {
    logger.error('calculatePrintCost error: %o', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Module 1: Update Production Stage ──────────────────────────────────────
const updateProductionStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStage, notes } = req.body;
    const currentUser = req.user || {};

    const card = await db.JobCard.findById(id);
    if (!card) return res.status(404).json({ error: 'Job card not found' });

    const prevStage = card.productionStage || 'Order Received';
    card.productionStage = newStage;
    await card.save();

    await db.OrderActivityLog.create({
      jobCardId: card._id,
      jobNo: card.jobNo,
      actor: (currentUser && currentUser._id && db.mongoose.Types.ObjectId.isValid(currentUser._id)) ? currentUser._id : null,
      actorName: currentUser.name || currentUser.username || 'System Operator',
      action: 'Stage Transition',
      previousStage: prevStage,
      newStage,
      notes: notes || ''
    });

    res.json({ success: true, data: card });
  } catch (err) {
    logger.error('updateProductionStage error: %o', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Module 1: Update Proofing Approval Status ────────────────────────────────
const updateProofingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { artworkUrl, artworkFileName, approvalStatus, clientFeedback } = req.body;

    const card = await db.JobCard.findById(id);
    if (!card) return res.status(404).json({ error: 'Job card not found' });

    if (!card.proofing) card.proofing = {};
    if (artworkUrl !== undefined) card.proofing.artworkUrl = artworkUrl;
    if (artworkFileName !== undefined) card.proofing.artworkFileName = artworkFileName;
    if (approvalStatus !== undefined) card.proofing.approvalStatus = approvalStatus;
    if (clientFeedback !== undefined) card.proofing.clientFeedback = clientFeedback;

    if (approvalStatus === 'Approved') {
      card.proofing.approvedAt = new Date();
    }

    await card.save();
    res.json({ success: true, data: card });
  } catch (err) {
    logger.error('updateProofingStatus error: %o', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllJobCards, getJobCard, createJobCard, updateJobCard,
  deleteJobCard, calcExpTimeEndpoint, getNextJobCardNumber, downloadJobCardPdf,
  downloadBulkJobCardsPdf, calculatePrintCost, updateProductionStage, updateProofingStatus
};
