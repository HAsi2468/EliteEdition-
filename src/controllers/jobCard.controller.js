const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ─── Google Drive URL converter ───────────────────────────────────────────────
function convertDriveUrl(link) {
  if (!link || !link.trim()) return '';
  if (link.includes('drive.google.com') || link.includes('googleusercontent') || link.includes('lh3.google')) {
    if (link.includes('uc?export') || link.includes('lh3.google') || link.includes('googleusercontent')) return link;
    const fileMatch = link.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
    const openMatch = link.match(/[?&]id=([-\w]{20,})/);
    if (openMatch) return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
    const idMatch = link.match(/([-\w]{25,})/);
    return idMatch ? `https://drive.google.com/uc?export=view&id=${idMatch[1]}` : link;
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
    const { status, search, page=1, limit=50, dateStart, dateEnd, sortBy, sortOrder } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd)   filter.date.$lte = dateEnd;
    }
    if (search) {
      filter.$or = [
        { jobNo:       { $regex: search, $options: 'i' } },
        { party:       { $regex: search, $options: 'i' } },
        { designNo:    { $regex: search, $options: 'i' } },
        { machineName: { $regex: search, $options: 'i' } },
        { billNo:      { $regex: search, $options: 'i' } },
      ];
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

const createJobCard = async (req, res) => {
  try {
    const body = req.body;
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
    if (body.panna && body.pass && body.totalMtr && body.machineName)
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);
    const existingCard = await db.JobCard.findById(req.params.id);
    if (!existingCard) return res.status(404).json({ error: 'Job card not found' });
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

// ─── PDF Generator ────────────────────────────────────────────────────────────
const downloadJobCardPdf = async (req, res) => {
  try {
    const jobCard = await db.JobCard.findById(req.params.id).lean();
    if (!jobCard) return res.status(404).json({ error: 'Job Card not found' });

    // Fall back to Design catalog image if job card has no imageUrl1
    let imageUrl1 = jobCard.imageUrl1 || '';
    let imageUrl2 = jobCard.imageUrl2 || '';
    if (!imageUrl1) {
      const key = jobCard.designName || jobCard.designNo;
      if (key) {
        const design = await db.Design.findOne({ designName: key }).lean();
        if (design) { imageUrl1 = design.imageUrl || ''; imageUrl2 = design.imageUrl2 || ''; }
      }
    }
    const [imgBuf1, imgBuf2] = await Promise.all([getImageBuffer(imageUrl1), getImageBuffer(imageUrl2)]);

    // PDF document
    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="JobCard_${jobCard.jobNo || 'preview'}.pdf"`);
    doc.pipe(res);

    // Page geometry
    const PW=595, PH=842, M=28, CW=PW-2*M;

    // Outer card border
    doc.strokeColor('#c8d4e0').lineWidth(1).rect(23, 28, 544, 786).stroke();

    // Header bar
    doc.rect(23, 28, 544, 48).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(19).font('Helvetica-Bold')
      .text('ELITE EDITION', 23, 38, { width:544, align:'center', lineBreak:false });
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text('Production Job Card', 23, 58, { width:544, align:'center', lineBreak:false });

    // Job No banner
    doc.rect(23, 76, 544, 26).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
      .text(`JOB CARD:  ${jobCard.jobNo||'—'}`, 31, 83, { width:200, lineBreak:false });
    const sCol = jobCard.status==='Done' ? '#22c55e' : jobCard.status==='In Progress' ? '#f59e0b' : '#ef4444';
    doc.fillColor(sCol).fontSize(9).font('Helvetica-Bold')
      .text(jobCard.status||'Pending', 23, 85, { width:544-16, align:'right', lineBreak:false });

    // Layout
    const BODY_Y=112, LX=31, LW=300, RX=352, RW=208;
    const IMG_Y=BODY_Y, IMG_H=200, RH=35;

    // Field helper — absolute position, no cursor side-effects, centering and size +2
    function F(label, value, x, y, w) {
      doc.fillColor('#8896a4').fontSize(8.5).font('Helvetica-Bold')
        .text(label.toUpperCase(), x, y, { width:w, align:'center', lineBreak:false });
      doc.fillColor('#0d1729').fontSize(11).font('Helvetica')
        .text(String(value||'—'), x, y+11, { width:w, align:'center', lineBreak:false });
    }

    // ── Image box (right side) ────────────────────────────────────────────
    doc.rect(RX, IMG_Y, RW, IMG_H).fill('#f1f5f9');  // background
    doc.fillColor('#8896a4').fontSize(8.5).font('Helvetica-Bold')
      .text('DESIGN IMAGE', RX+4, IMG_Y+3, { width:RW-8, align:'center', lineBreak:false });

    const logoPath = path.join(__dirname, 'Logo.png');
    let logoBuf = null;
    if (fs.existsSync(logoPath)) {
      logoBuf = fs.readFileSync(logoPath);
    }

    try {
      if (imgBuf1 && imgBuf2) {
        const h2 = Math.floor((IMG_H-18)/2)-2;
        doc.image(imgBuf1, RX+4, IMG_Y+14,    { fit:[RW-8, h2] });
        doc.image(imgBuf2, RX+4, IMG_Y+16+h2, { fit:[RW-8, h2] });
      } else if (imgBuf1 && logoBuf) {
        const h2 = Math.floor((IMG_H-18)/2)-2;
        doc.image(imgBuf1, RX+4, IMG_Y+14,    { fit:[RW-8, h2] });
        doc.save();
        doc.opacity(0.15);
        doc.image(logoBuf, RX+4, IMG_Y+16+h2, { fit:[RW-8, h2] });
        doc.restore();
      } else if (imgBuf1) {
        doc.image(imgBuf1, RX+4, IMG_Y+14, { fit:[RW-8, IMG_H-18] });
      } else if (logoBuf) {
        const h2 = Math.floor((IMG_H-18)/2)-2;
        doc.fillColor('#b0bec5').fontSize(8.5).font('Helvetica-Oblique')
          .text('No Image', RX, IMG_Y+40, { width:RW, align:'center', lineBreak:false });
        doc.save();
        doc.opacity(0.15);
        doc.image(logoBuf, RX+4, IMG_Y+16+h2, { fit:[RW-8, h2] });
        doc.restore();
      } else {
        doc.fillColor('#b0bec5').fontSize(8.5).font('Helvetica-Oblique')
          .text('No Image', RX, IMG_Y+90, { width:RW, align:'center', lineBreak:false });
      }
    } catch(e) {
      logger.warn('PDF image error: %s', e.message);
      doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica-Oblique')
        .text('Image error', RX, IMG_Y+90, { width:RW, align:'center', lineBreak:false });
    }
    doc.strokeColor('#c8d4e0').rect(RX, IMG_Y, RW, IMG_H).stroke();  // border on top

    // ── Fields right of image (below image box) ───────────────────────────
    let ry = IMG_Y + IMG_H + 8;
    [['Panna',jobCard.panna],['Pass',jobCard.pass],['Total Metres',jobCard.totalMtr],
     ['Expected Time',jobCard.expTime],['Machine',jobCard.machineName],['Bill No.',jobCard.billNo]]
    .forEach(([l,v]) => { F(l,v,RX,ry,RW); ry+=RH; });


    // ── Left fields ───────────────────────────────────────────────────────
    let ly = BODY_Y;
    [['Design Name', jobCard.designName||jobCard.designNo],
     ['Design No.',  jobCard.designNo||jobCard.designName],
     ['Party',       jobCard.party],
     ['Fabric',      jobCard.fabric],
     ['Category',    jobCard.category],
     ['PCS',         jobCard.pcs],
     ['Consumption', jobCard.consumption],
     ['Designer',    jobCard.designer],
     ['Colour Matching', jobCard.colourMatching],
     ['Paper Type',  jobCard.paperType],
     ['Temperature', jobCard.temperature],
     ['Speed',       jobCard.speed],
     ['Profile',     jobCard.profile]]
    .forEach(([l,v]) => { F(l,v,LX,ly,LW-8); ly+=RH; });

    // ── Divider ───────────────────────────────────────────────────────────
    const divY = Math.max(ly, ry) + 12;
    doc.moveTo(23, divY).lineTo(567, divY).strokeColor('#dde3ea').lineWidth(0.5).stroke();

    // ── Status Tracking ───────────────────────────────────────────────────
    let ty = divY + 12;
    doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold')
      .text('STATUS TRACKING', 31, ty, { lineBreak:false });
    ty += 16;
    const tcW = 126.75;
    [['Print Status',jobCard.printStatus],['Print Date',jobCard.printDate],
     ['Print Metres',jobCard.printMtr],['Fusing Status',jobCard.fusingStatus],
     ['Fusing Date',jobCard.fusingDate],['Delivery Status',jobCard.deliveryStatus],
     ['Delivery Date',jobCard.deliveryDate],['Created Date',jobCard.date]]
    .forEach(([l,v],i) => F(l,v, 31+(i%4)*130, ty+Math.floor(i/4)*35, 120));
    ty += 80;

    // ── Notes ─────────────────────────────────────────────────────────────
    if (jobCard.emergencyNotes || jobCard.note1 || jobCard.note2) {
      doc.moveTo(23,ty).lineTo(567,ty).strokeColor('#dde3ea').lineWidth(0.5).stroke();
      ty+=12;
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold').text('NOTES', 31, ty, { lineBreak:false });
      ty+=16;
      if (jobCard.emergencyNotes) {
        doc.fillColor('#ef4444').fontSize(8.5).font('Helvetica-Bold')
          .text('⚠ EMERGENCY: '+jobCard.emergencyNotes, 31, ty, { width:500 }); ty+=22;
      }
      if (jobCard.note1) { F('Note 1',jobCard.note1,31,ty,500); ty+=38; }
      if (jobCard.note2) { F('Note 2',jobCard.note2,31,ty,500); ty+=38; }
    }

    doc.end();
  } catch (err) {
    logger.error('downloadJobCardPdf error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAllJobCards, getJobCard, createJobCard, updateJobCard,
  deleteJobCard, calcExpTimeEndpoint, getNextJobCardNumber, downloadJobCardPdf
};
