const mongoose = require('mongoose');
const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { publishActivity } = require('../utils/activityEvent');
const { emitSocketEvent } = require('../utils/socketEmitHelper');

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
  const { normalizeImageUrl } = require('../utils/imageUrlHelper');
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
    const up = path.join(__dirname, '../../uploads', url);
    if (fs.existsSync(up)) return fs.readFileSync(up);
    const dp = path.join(__dirname, '../../../elite_edition_images', url);
    if (fs.existsSync(dp)) return fs.readFileSync(dp);

    // Normalize relative or design URLs (like /designs/image-xxx.jpg) to full R2 / HTTPS URL
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = normalizeImageUrl(url);
    }

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const fetchBuffer = async (u) => {
        try {
          const r = await axios.get(convertDriveUrl(u), {
            responseType: 'arraybuffer',
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          return Buffer.from(r.data);
        } catch (e) {
          return null;
        }
      };

      let buf = await fetchBuffer(targetUrl);
      if (buf) return buf;

      // Try alternate extensions on R2 (e.g. .jpg <-> .jpeg <-> .png)
      if (targetUrl.endsWith('.jpg')) {
        buf = await fetchBuffer(targetUrl.replace(/\.jpg$/, '.jpeg'));
        if (buf) return buf;
        buf = await fetchBuffer(targetUrl.replace(/\.jpg$/, '.png'));
        if (buf) return buf;
      } else if (targetUrl.endsWith('.jpeg')) {
        buf = await fetchBuffer(targetUrl.replace(/\.jpeg$/, '.jpg'));
        if (buf) return buf;
        buf = await fetchBuffer(targetUrl.replace(/\.jpeg$/, '.png'));
        if (buf) return buf;
      } else if (targetUrl.endsWith('.png')) {
        buf = await fetchBuffer(targetUrl.replace(/\.png$/, '.jpg'));
        if (buf) return buf;
      }
    }
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
  let pannaNum = Number((String(panna||'').match(/\d+/)||[])[0]);
  let pass     = Number((String(passText||'').match(/\d+/)||[])[0]);
  if (!totalMtr || Number(totalMtr) <= 0) return '';

  const mName = String(machineName||'').trim().toUpperCase();
  const table = mName === 'GRANDO' ? SPEED_GRANDO : SPEED_PRINTDOT;

  if (!pannaNum) pannaNum = 58;
  const availablePannas = [36, 38, 42, 44, 46, 58];
  let targetPanna = availablePannas.reduce((prev, curr) => 
    Math.abs(curr - pannaNum) < Math.abs(prev - pannaNum) ? curr : prev
  );

  if (!pass) pass = 4;
  const availablePasses = [1, 2, 4, 6, 8];
  let targetPass = availablePasses.reduce((prev, curr) => 
    Math.abs(curr - pass) < Math.abs(prev - pass) ? curr : prev
  );

  const speed = (table[targetPanna] && table[targetPanna][targetPass]) || 186;
  const time = Number(totalMtr) / speed;
  let h = Math.floor(time);
  let m = Math.round((time - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${h}H & ${m}M`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
const getAllJobCards = async (req, res) => {
  try {
    const { status, printStatus, fusingStatus, deliveryStatus, party, search, page=1, limit=50, dateStart, dateEnd, sortBy, sortOrder, category, department } = req.query;
    const baseFilter = {};
    const baseAndClauses = [];

    // Filter by Party (Client Company Code or Name)
    if (party && party !== 'All') {
      const partyParts = String(party).split(',').map(p => p.trim()).filter(Boolean);
      const partyOrs = [];
      partyParts.forEach(p => {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const subRegex = { $regex: escaped, $options: 'i' };
        partyOrs.push(
          { party: subRegex },
          { billTo: subRegex },
          { shipTo: subRegex },
          { createdBy: subRegex },
          { createdByName: subRegex }
        );
      });
      if (partyOrs.length > 0) {
        baseAndClauses.push({ $or: partyOrs });
      }
    }

    if (category && category !== 'All') baseFilter.category = category;

    if (department === 'stitching') {
      baseAndClauses.push({
        $or: [
          { department: 'stitching' },
          { category: { $regex: 'stitching', $options: 'i' } }
        ]
      });
    } else if (department === 'all' || party) {
      // If party is specified (e.g. client portal) or department=all, do not exclude records
    } else {
      baseFilter.department = { $ne: 'stitching' };
      baseFilter.category = { $ne: 'Stitching' };
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000+05:30`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999+05:30`).getTime()) : null;

      const dateQuery = {};
      if (minMs !== null) dateQuery.$gte = new Date(minMs);
      if (maxMs !== null) dateQuery.$lte = new Date(maxMs);

      // Find all Job Card IDs that have print logs in this date range
      const printLogQuery = {};
      if (minMs !== null) printLogQuery.$gte = new Date(minMs);
      if (maxMs !== null) printLogQuery.$lte = new Date(maxMs);

      let matchingLogIds = [];
      try {
        matchingLogIds = await db.JobPrintLog.distinct('jobCardId', {
          $or: [
            { date: printLogQuery },
            { createdAt: printLogQuery }
          ]
        });
      } catch (e) {
        logger.warn('Failed to query JobPrintLog distinct IDs: %s', e.message);
      }

      const dateOr = [
        { date: dateQuery },
        { date: { $gte: dsStr, $lte: deStr } },
        { printDate: { $gte: dsStr, $lte: deStr } },
        { printDate: dateQuery },
        { fusingDate: { $gte: dsStr, $lte: deStr } },
        { fusingDate: dateQuery },
        { deliveryDate: { $gte: dsStr, $lte: deStr } },
        { deliveryDate: dateQuery },
        { createdAt: dateQuery },
        { created_date_time: dateQuery }
      ];

      if (matchingLogIds && matchingLogIds.length > 0) {
        dateOr.push({ _id: { $in: matchingLogIds } });
      }

      baseAndClauses.push({ $or: dateOr });
    }

    if (search) {
      const trimmed = search.trim();
      const digitsOnly = trimmed.replace(/\D/g, '');
      const searchRegex = { $regex: trimmed, $options: 'i' };
      
      const searchOr = [
        { jobNo:       searchRegex },
        { party:       searchRegex },
        { designNo:    searchRegex },
        { designName:  searchRegex },
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

      baseAndClauses.push({ $or: searchOr });
    }

    if (baseAndClauses.length > 0) {
      baseFilter.$and = baseAndClauses;
    }

    // Clone baseFilter for active query filter
    const filter = { ...baseFilter };
    const andClauses = baseAndClauses.slice();

    if (status && status !== 'All') {
      if (status === 'Printing') {
        filter.printStatus = { $ne: 'Printing Done' };
      } else if (status === 'Fusing') {
        filter.printStatus = 'Printing Done';
        filter.fusingStatus = { $ne: 'Fusing Done' };
      } else if (status === 'Delivery') {
        filter.fusingStatus = 'Fusing Done';
      } else if (status === 'Pending') {
        filter.status = 'Pending';
      } else {
        filter.status = status;
      }
    }

    if (printStatus && printStatus !== 'All') {
      if (printStatus === 'Printing Done') {
        filter.printStatus = 'Printing Done';
      } else if (printStatus === 'Printing Pending') {
        andClauses.push({ printStatus: { $ne: 'Printing Done' } });
      }
    }

    if (fusingStatus && fusingStatus !== 'All') {
      if (fusingStatus === 'Fusing Done') {
        filter.fusingStatus = 'Fusing Done';
      } else if (fusingStatus === 'Fusing Pending') {
        andClauses.push({ fusingStatus: { $ne: 'Fusing Done' } });
      }
    }

    if (deliveryStatus && deliveryStatus !== 'All') {
      if (deliveryStatus === 'Delivery Done') {
        filter.deliveryStatus = 'Delivery Done';
      } else if (deliveryStatus === 'Delivery Pending') {
        andClauses.push({ deliveryStatus: { $ne: 'Delivery Done' } });
      }
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    let total = 0;
    let totalMtr = 0;
    let statusCounts = {};

    const shouldSkipStats = req.query.skipStats === 'true' || Number(page) > 1;

    if (shouldSkipStats) {
      total = await db.JobCard.countDocuments(filter);
    } else {
      const meterExpr = {
        $convert: {
          input: '$totalMtr',
          to: 'double',
          onError: 0,
          onNull: 0
        }
      };

      const statsFacet = await db.JobCard.aggregate([
        {
          $facet: {
            current: [
              { $match: filter },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ],
            all: [
              { $match: baseFilter },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ],
            pending: [
              { $match: { ...baseFilter, status: 'Pending' } },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ],
            printing: [
              { $match: { ...baseFilter, printStatus: { $ne: 'Printing Done' } } },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ],
            fusing: [
              { $match: { ...baseFilter, printStatus: 'Printing Done', fusingStatus: { $ne: 'Fusing Done' } } },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ],
            delivery: [
              { $match: { ...baseFilter, fusingStatus: 'Fusing Done' } },
              { $group: { _id: null, count: { $sum: 1 }, totalMtr: { $sum: meterExpr } } }
            ]
          }
        }
      ]);

      const facetData = statsFacet && statsFacet[0] ? statsFacet[0] : {};
      const curStats = facetData.current && facetData.current[0] ? facetData.current[0] : { count: 0, totalMtr: 0 };
      total = curStats.count || 0;
      totalMtr = Math.round((curStats.totalMtr || 0) * 100) / 100;

      statusCounts = {
        All: { count: facetData.all?.[0]?.count || 0, meters: Math.round((facetData.all?.[0]?.totalMtr || 0) * 100) / 100 },
        Pending: { count: facetData.pending?.[0]?.count || 0, meters: Math.round((facetData.pending?.[0]?.totalMtr || 0) * 100) / 100 },
        Printing: { count: facetData.printing?.[0]?.count || 0, meters: Math.round((facetData.printing?.[0]?.totalMtr || 0) * 100) / 100 },
        Fusing: { count: facetData.fusing?.[0]?.count || 0, meters: Math.round((facetData.fusing?.[0]?.totalMtr || 0) * 100) / 100 },
        Delivery: { count: facetData.delivery?.[0]?.count || 0, meters: Math.round((facetData.delivery?.[0]?.totalMtr || 0) * 100) / 100 }
      };
    }

    const skip  = (Number(page)-1) * Number(limit);

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
    } else if (!sortBy || sortBy === 'jobNo' || sortBy === 'created_date_time' || sortBy === 'createdAt') {
      const order = sortOrder === 'asc' ? 1 : -1;
      cards = await db.JobCard.find(filter)
        .sort({ created_date_time: order, _id: order })
        .skip(skip)
        .limit(Number(limit))
        .lean();
    } else {
      const order = sortOrder === 'asc' ? 1 : -1;
      const sortObj = { [sortBy]: order };
      cards = await db.JobCard.find(filter)
        .collation({ locale:'en', numericOrdering:true })
        .sort(sortObj).skip(skip).limit(Number(limit)).lean();
    }

    // Auto-fill any missing design catalogue parameters dynamically
    (cards || []).forEach(c => {
      const pcsNum = parseFloat(c.pcs) || 0;
      const mtrNum = parseFloat(c.totalMtr) || 0;
      const consNum = parseFloat(c.consumption) || 0;
      if (!c.consumption && mtrNum > 0 && pcsNum > 0) {
        c.consumption = (mtrNum / pcsNum).toFixed(2);
      }
      if (!c.totalMtr && consNum > 0 && pcsNum > 0) {
        c.totalMtr = (consNum * pcsNum).toFixed(2);
      }
      if (!c.fusingTemp && c.temperature) c.fusingTemp = c.temperature;
      if (!c.temperature && c.fusingTemp) c.temperature = c.fusingTemp;
    });

    const missingDesignCards = (cards || []).filter(c => 
      (!c.totalMtr || !c.consumption || !c.top || !c.bottom || !c.pass || !c.designer || !c.speed || !c.fusingTemp || !c.temperature || !c.fabric) && 
      (c.designName || c.designNo)
    );
    if (missingDesignCards.length > 0) {
      try {
        const uniqueNames = [...new Set(missingDesignCards.map(c => String(c.designName || c.designNo).trim()))];
        const searchTerms = [];
        uniqueNames.forEach(n => {
          searchTerms.push(n);
          searchTerms.push(n.replace(/^ED-/i, '').trim());
          searchTerms.push(`ED-${n.replace(/^ED-/i, '').trim()}`);
        });

        const designDocs = await db.Design.find({
          $or: [
            { designName: { $in: searchTerms } },
            { designNo: { $in: searchTerms } }
          ]
        }).lean();
        const dMap = new Map();
        designDocs.forEach(d => {
          if (d.designName) {
            dMap.set(d.designName.trim().toUpperCase(), d);
            dMap.set(d.designName.replace(/^ED-/i, '').trim().toUpperCase(), d);
          }
          if (d.designNo) {
            dMap.set(d.designNo.trim().toUpperCase(), d);
            dMap.set(d.designNo.replace(/^ED-/i, '').trim().toUpperCase(), d);
          }
        });

        cards.forEach(c => {
          const raw = String(c.designName || c.designNo || '').trim().toUpperCase();
          const clean = raw.replace(/^ED-/i, '').trim();
          const d = dMap.get(raw) || dMap.get(clean);
          if (d) {
            const pcsNum = parseFloat(c.pcs) || 0;
            if (!c.consumption && d.totalMtr100) c.consumption = (d.totalMtr100 / 100).toFixed(2);
            if (!c.totalMtr && d.totalMtr100 && pcsNum > 0) c.totalMtr = ((d.totalMtr100 / 100) * pcsNum).toFixed(2);
            if (!c.top && d.top100 && pcsNum > 0) c.top = ((d.top100 / 100) * pcsNum).toFixed(2);
            if (!c.sleeve && d.sleeve100 && pcsNum > 0) c.sleeve = ((d.sleeve100 / 100) * pcsNum).toFixed(2);
            if (!c.bottom && d.bottom100 && pcsNum > 0) c.bottom = ((d.bottom100 / 100) * pcsNum).toFixed(2);
            if (!c.dupatta && d.dupatta100 && pcsNum > 0) c.dupatta = ((d.dupatta100 / 100) * pcsNum).toFixed(2);
            if (!c.cut && d.cut100) c.cut = d.cut100.toString();
            if (!c.setCopy && d.setCopy100 && pcsNum > 0) c.setCopy = Math.round((d.setCopy100 / 100) * pcsNum).toString();
            if (!c.pass && d.pass) c.pass = d.pass;
            if (!c.speed && d.speed) c.speed = d.speed;
            if (!c.designer && d.designerName) c.designer = d.designerName;
            if (!c.colourMatching && d.colourMatching) c.colourMatching = d.colourMatching;
            if (!c.paperType && d.paperType) c.paperType = d.paperType;
            const fused = d.fusingTemp || d.temperature || '';
            if (!c.fusingTemp && fused) c.fusingTemp = fused;
            if (!c.temperature && fused) c.temperature = fused;
            if (!c.fabric && d.fabricName) c.fabric = d.fabricName;
            if (!c.category && d.category) c.category = d.category;
            if (!c.colors && d.colors) c.colors = d.colors;
            if (!c.panna && d.panna) c.panna = d.panna;
            if (!c.imageUrl1 && d.imageUrl) c.imageUrl1 = d.imageUrl;
            if (!c.imageUrl && d.imageUrl) c.imageUrl = d.imageUrl;
          }
        });
      } catch (e) {
        logger.warn('Failed to dynamically enrich cards with design specs: %s', e.message);
      }
    }

    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    const normalizedCards = (cards || []).map(c => ({
      ...c,
      imageUrl1: normalizeImageUrl(c.imageUrl1 || c.imageUrl, c.designName || c.designNo),
      imageUrl2: normalizeImageUrl(c.imageUrl2, c.designName ? `${c.designName}-2` : ''),
    }));

    res.json({
      data: normalizedCards,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    logger.error('getAllJobCards error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getJobCard = async (req, res) => {
  try {
    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    const mongoose = require('mongoose');
    const param = req.params.id || req.params.jobNo;
    let card = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      card = await db.JobCard.findById(param).lean();
    }
    if (!card) {
      const cleanJobNo = String(param).replace(/^JC-/i, '').replace(/^JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
      const num = parseInt(cleanJobNo, 10);
      const query = { $or: [{ jobNo: cleanJobNo }, { jobNo: String(cleanJobNo) }] };
      if (!isNaN(num)) query.$or.push({ jobNo: num });
      card = await db.JobCard.findOne(query).lean();
    }

    if (!card) return res.status(404).json({ error: 'Job card not found' });

    // Auto-fill any missing design catalogue parameters dynamically
    const pcsNum = parseFloat(card.pcs) || 0;
    const mtrNum = parseFloat(card.totalMtr) || 0;
    const consNum = parseFloat(card.consumption) || 0;
    if (!card.consumption && mtrNum > 0 && pcsNum > 0) {
      card.consumption = (mtrNum / pcsNum).toFixed(2);
    }
    if (!card.totalMtr && consNum > 0 && pcsNum > 0) {
      card.totalMtr = (consNum * pcsNum).toFixed(2);
    }
    if (!card.fusingTemp && card.temperature) card.fusingTemp = card.temperature;
    if (!card.temperature && card.fusingTemp) card.temperature = card.fusingTemp;

    const rawName = String(card.designName || card.designNo || '').trim();
    if (rawName && (!card.totalMtr || !card.consumption || !card.top || !card.bottom || !card.pass || !card.designer || !card.speed || !card.temperature || !card.fusingTemp || !card.fabric)) {
      let d = await db.Design.findOne({ designName: rawName }).lean();
      if (!d) d = await db.Design.findOne({ designNo: rawName }).lean();
      if (!d) {
        const clean = rawName.replace(/^ED-/i, '').trim();
        const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        d = await db.Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designName: { $regex: new RegExp(escaped, 'i') } }
          ]
        }).lean();
      }
      if (d) {
        if (!card.consumption && d.totalMtr100) card.consumption = (d.totalMtr100 / 100).toFixed(2);
        if (!card.totalMtr && d.totalMtr100 && pcsNum > 0) card.totalMtr = ((d.totalMtr100 / 100) * pcsNum).toFixed(2);
        if (!card.top && d.top100 && pcsNum > 0) card.top = ((d.top100 / 100) * pcsNum).toFixed(2);
        if (!card.sleeve && d.sleeve100 && pcsNum > 0) card.sleeve = ((d.sleeve100 / 100) * pcsNum).toFixed(2);
        if (!card.bottom && d.bottom100 && pcsNum > 0) card.bottom = ((d.bottom100 / 100) * pcsNum).toFixed(2);
        if (!card.dupatta && d.dupatta100 && pcsNum > 0) card.dupatta = ((d.dupatta100 / 100) * pcsNum).toFixed(2);
        if (!card.cut && d.cut100) card.cut = d.cut100.toString();
        if (!card.setCopy && d.setCopy100 && pcsNum > 0) card.setCopy = Math.round((d.setCopy100 / 100) * pcsNum).toString();
        if (!card.pass && d.pass) card.pass = d.pass;
        if (!card.speed && d.speed) card.speed = d.speed;
        if (!card.designer && d.designerName) card.designer = d.designerName;
        if (!card.colourMatching && d.colourMatching) card.colourMatching = d.colourMatching;
        if (!card.paperType && d.paperType) card.paperType = d.paperType;
        const fused = d.fusingTemp || d.temperature || '';
        if (!card.fusingTemp && fused) card.fusingTemp = fused;
        if (!card.temperature && fused) card.temperature = fused;
        if (!card.fabric && d.fabricName) card.fabric = d.fabricName;
        if (!card.category && d.category) card.category = d.category;
        if (!card.colors && d.colors) card.colors = d.colors;
        if (!card.panna && d.panna) card.panna = d.panna;
        if (!card.imageUrl1 && d.imageUrl) card.imageUrl1 = d.imageUrl;
        if (!card.imageUrl && d.imageUrl) card.imageUrl = d.imageUrl;
      }
    }

    card.imageUrl1 = normalizeImageUrl(card.imageUrl1 || card.imageUrl, card.designName || card.designNo);
    card.imageUrl2 = normalizeImageUrl(card.imageUrl2, card.designName ? `${card.designName}-2` : '');
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
    const rawParts = String(dName).split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
    const names = rawParts.length > 0 ? rawParts : [String(dName).trim()];
    try {
      if (names[0] && !body.imageUrl1) {
        const clean1 = names[0].replace(/^ED-/i, '');
        const designDoc1 = await db.Design.findOne({
          $or: [
            { designName: { $regex: `^(ED-)?${clean1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { designNo: { $regex: `^(ED-)?${clean1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
          ]
        }).lean();
        if (designDoc1 && (designDoc1.imageUrl || designDoc1.imageUrl2)) {
          body.imageUrl1 = designDoc1.imageUrl || designDoc1.imageUrl2;
        }
      }
      if (names.length >= 2 && names[1] && !body.imageUrl2) {
        const clean2 = names[1].replace(/^ED-/i, '');
        const designDoc2 = await db.Design.findOne({
          $or: [
            { designName: { $regex: `^(ED-)?${clean2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { designNo: { $regex: `^(ED-)?${clean2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
          ]
        }).lean();
        if (designDoc2) {
          body.imageUrl2 = designDoc2.imageUrl || designDoc2.imageUrl2 || '';
        }
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

    await syncDesignImage(body).catch(e => logger.warn('syncDesignImage failed: %s', e.message));

    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    if (body.imageUrl1) body.imageUrl1 = normalizeImageUrl(body.imageUrl1, body.designName || body.designNo);
    if (body.imageUrl2) body.imageUrl2 = normalizeImageUrl(body.imageUrl2, body.designName ? `${body.designName}-2` : '');
    if (body.imageUrl) body.imageUrl = normalizeImageUrl(body.imageUrl, body.designName || body.designNo);

    const creatorName = req.user?.name || body.userName || body.createdBy || 'Staff User';
    const creatorId = req.user?._id || body.userId || body.createdById;
    body.createdBy = creatorName;
    body.createdByName = creatorName;
    if (creatorId) body.userId = creatorId;

    body.auditTrail = [
      {
        performedBy: creatorName,
        performedByName: creatorName,
        performedById: String(creatorId || ''),
        action: 'CREATE',
        timestamp: new Date(),
        details: `Job Card created for party "${body.party || ''}" (Qty: ${body.totalMtr || 0}m, Fabric: ${body.fabric || ''})`,
        changesSummary: 'Job Card Created'
      }
    ];

    // Auto-fill from design catalogue if fields are missing
    const rawDesign = String(body.designName || body.designNo || '').trim();
    if (rawDesign) {
      let d = await db.Design.findOne({ designName: rawDesign }).lean();
      if (!d) d = await db.Design.findOne({ designNo: rawDesign }).lean();
      if (!d) {
        const clean = rawDesign.replace(/^ED-/i, '').trim();
        const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        d = await db.Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designName: { $regex: new RegExp(escaped, 'i') } }
          ]
        }).lean();
      }
      if (d) {
        const pNum = parseFloat(body.pcs) || 0;
        if (!body.consumption && d.totalMtr100) body.consumption = (d.totalMtr100 / 100).toFixed(2);
        if (!body.totalMtr && d.totalMtr100 && pNum > 0) body.totalMtr = ((d.totalMtr100 / 100) * pNum).toFixed(2);
        if (!body.top && d.top100 && pNum > 0) body.top = ((d.top100 / 100) * pNum).toFixed(2);
        if (!body.sleeve && d.sleeve100 && pNum > 0) body.sleeve = ((d.sleeve100 / 100) * pNum).toFixed(2);
        if (!body.bottom && d.bottom100 && pNum > 0) body.bottom = ((d.bottom100 / 100) * pNum).toFixed(2);
        if (!body.dupatta && d.dupatta100 && pNum > 0) body.dupatta = ((d.dupatta100 / 100) * pNum).toFixed(2);
        if (!body.cut && d.cut100) body.cut = d.cut100.toString();
        if (!body.setCopy && d.setCopy100 && pNum > 0) body.setCopy = Math.round((d.setCopy100 / 100) * pNum).toString();
        if (!body.pass && d.pass) body.pass = d.pass;
        if (!body.speed && d.speed) body.speed = d.speed;
        if (!body.designer && d.designerName) body.designer = d.designerName;
        if (!body.colourMatching && d.colourMatching) body.colourMatching = d.colourMatching;
        if (!body.paperType && d.paperType) body.paperType = d.paperType;
        const fused = d.fusingTemp || d.temperature || '';
        if (!body.fusingTemp && fused) body.fusingTemp = fused;
        if (!body.temperature && fused) body.temperature = fused;
        if (!body.fabric && d.fabricName) body.fabric = d.fabricName;
        if (!body.category && d.category) body.category = d.category;
        if (!body.colors && d.colors) body.colors = d.colors;
        if (!body.panna && d.panna) body.panna = d.panna;
        if (!body.imageUrl1 && d.imageUrl) body.imageUrl1 = d.imageUrl;
        if (!body.imageUrl && d.imageUrl) body.imageUrl = d.imageUrl;
      }
    }
    const pcsNum = parseFloat(body.pcs) || 0;
    const mtrNum = parseFloat(body.totalMtr) || 0;
    const consNum = parseFloat(body.consumption) || 0;
    if (!body.consumption && mtrNum > 0 && pcsNum > 0) body.consumption = (mtrNum / pcsNum).toFixed(2);
    if (!body.totalMtr && consNum > 0 && pcsNum > 0) body.totalMtr = (consNum * pcsNum).toFixed(2);
    if (!body.fusingTemp && body.temperature) body.fusingTemp = body.temperature;
    if (!body.temperature && body.fusingTemp) body.temperature = body.fusingTemp;

    const card = await db.JobCard.create(body);

    const dNo = card.designName || card.designNo || 'N/A';
    const fab = card.fabric || 'N/A';
    const mtr = card.totalMtr ? `${card.totalMtr}m` : '0m';
    const pcsStr = card.pcs ? ` (${card.pcs} pcs)` : '';
    const mach = card.machineName || 'Machine';

    publishActivity({
      actorId: creatorId,
      actorName: creatorName,
      action: 'CREATE',
      module: 'Job Card',
      recordRef: card.jobNo || 'N/A',
      recordId: card._id,
      permissionScope: 'jobcards',
      department: 'Production',
      description: `📋 **New Job Card #${card.jobNo || ''}** created for party **"${card.party || 'Client'}"** | Design: **${dNo}** | Fabric: **${fab}** | Qty: **${mtr}**${pcsStr} | Machine: **${mach}** by **${creatorName}**.`
    }).catch(e => logger.warn('publishActivity failed on job card create: %s', e.message));

    emitSocketEvent(req, 'job-created', card);

    res.status(201).json(card);
  } catch (err) {
    logger.error('createJobCard error: %o', err);
    if (err.code === 11000) return res.status(400).json({ error: `Job No. "${req.body.jobNo}" already exists.` });
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const createClientBulkOrder = async (req, res) => {
  try {
    const { items, clientInfo } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one order entry is required.' });
    }

    const partyCode = (clientInfo?.companyCode || clientInfo?.partyCode || req.user?.companyCode || '').trim();
    const companyName = (clientInfo?.companyName || clientInfo?.name || req.user?.companyName || '').trim();
    const username = (clientInfo?.username || req.user?.username || '').trim();
    const clientDisplayName = companyName || username || partyCode || 'Client Partner';
    const creatorString = `Client: ${clientDisplayName}${partyCode ? ` (${partyCode})` : ''}`;

    // Get current max job number
    const config = await db.PrintConfig.findOne({ isConfig: true });
    const startingNo = config && config.startingJobNo ? config.startingJobNo : 1;
    const [result] = await db.JobCard.aggregate([
      {
        $addFields: {
          jobNoNum: {
            $convert: {
              input: {
                $let: {
                  vars: { m: { $regexFind: { input: '$jobNo', regex: '\\d+' } } },
                  in: '$$m.match'
                }
              },
              to: 'int',
              onError: 0,
              onNull: 0
            }
          }
        }
      },
      { $group: { _id: null, maxNo: { $max: '$jobNoNum' } } }
    ]);
    let nextNum = (result ? Math.max(result.maxNo, startingNo - 1) : startingNo - 1) + 1;

    const createdCards = [];

    for (const item of items) {
      const rawDesignName = String(item.designName || item.designNo || '').trim();
      if (!rawDesignName) continue;

      const jobNo = `JOB NO.- ${nextNum++}`;

      // 1. Lookup design in DB by ID if provided
      let designDoc = null;
      if (item.designId && mongoose.Types.ObjectId.isValid(item.designId)) {
        try {
          designDoc = await db.Design.findById(item.designId).lean();
        } catch (e) {}
      }

      // 2. Lookup design by exact designName or designNo
      if (!designDoc) {
        designDoc = await db.Design.findOne({ designName: rawDesignName }).lean();
      }
      if (!designDoc) {
        designDoc = await db.Design.findOne({ designNo: rawDesignName }).lean();
      }

      // 3. Fallback: Lookup design case-insensitively, handling optional ED- prefix
      if (!designDoc) {
        const cleanName = rawDesignName.replace(/^ED-/i, '').trim();
        const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        designDoc = await db.Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${escaped}$`, 'i') } },
            { designName: { $regex: new RegExp(escaped, 'i') } }
          ]
        }).lean();
      }

      const designName = designDoc?.designName || rawDesignName;
      const fabric = (item.fabric || designDoc?.fabricName || 'FRENCH CREP').trim();
      const category = (item.category || designDoc?.category || 'KURTI-SET').trim();
      const colors = (item.colors || designDoc?.colors || '').trim();
      const panna = (item.panna || designDoc?.panna || '58').trim();
      const pass = (item.pass || designDoc?.pass || '').trim();
      const speed = (item.speed || designDoc?.speed || '').trim();
      const designer = (item.designer || designDoc?.designerName || '').trim();
      const colourMatching = (item.colourMatching || designDoc?.colourMatching || '').trim();
      const paperType = (item.paperType || designDoc?.paperType || '').trim();
      const fusingTemp = (item.fusingTemp || item.temperature || designDoc?.fusingTemp || '').trim();
      const temperature = fusingTemp;
      const pcs = String(item.pcs || item.pieces || '0').trim();
      const note = String(item.note || item.notes || '').trim();
      const date = item.date ? normalizeDateStr(item.date) : normalizeDateStr(new Date().toISOString().split('T')[0]);

      // 100 Pcs Standards auto-calculations
      const pcsNum = parseFloat(pcs) || 0;
      const top100 = Number(designDoc?.top100 ?? item.top100 ?? 0);
      const sleeve100 = Number(designDoc?.sleeve100 ?? item.sleeve100 ?? 0);
      const bottom100 = Number(designDoc?.bottom100 ?? item.bottom100 ?? 0);
      const dupatta100 = Number(designDoc?.dupatta100 ?? item.dupatta100 ?? 0);
      const cut100 = Number(designDoc?.cut100 ?? item.cut100 ?? 0);
      const totalMtr100 = Number(designDoc?.totalMtr100 ?? item.totalMtr100 ?? 0);
      const setCopy100 = Number(designDoc?.setCopy100 ?? item.setCopy100 ?? 0);

      const consumption = totalMtr100 > 0 ? (totalMtr100 / 100).toFixed(2) : (item.consumption || '');
      const totalMtr = totalMtr100 > 0 && pcsNum > 0 ? ((totalMtr100 / 100) * pcsNum).toFixed(2) : (item.totalMtr || '');
      const top = top100 > 0 && pcsNum > 0 ? ((top100 / 100) * pcsNum).toFixed(2) : (item.top || '');
      const sleeve = sleeve100 > 0 && pcsNum > 0 ? ((sleeve100 / 100) * pcsNum).toFixed(2) : (item.sleeve || '');
      const bottom = bottom100 > 0 && pcsNum > 0 ? ((bottom100 / 100) * pcsNum).toFixed(2) : (item.bottom || '');
      const dupatta = dupatta100 > 0 && pcsNum > 0 ? ((dupatta100 / 100) * pcsNum).toFixed(2) : (item.dupatta || '');
      const cut = cut100 > 0 ? cut100.toString() : (item.cut || '');
      const setCopy = setCopy100 > 0 && pcsNum > 0 ? Math.round((setCopy100 / 100) * pcsNum).toString() : (item.setCopy || '');
      const expTime = calcExpTime(panna, pass, totalMtr, '');

      // Normalize artwork image URLs
      const { normalizeImageUrl } = require('../utils/imageUrlHelper');
      let rawImg1 = designDoc?.imageUrl || item.imageUrl1 || item.imageUrl || '';
      let rawImg2 = designDoc?.imageUrl2 || item.imageUrl2 || '';
      let img1 = rawImg1 ? normalizeImageUrl(rawImg1, designName) : '';
      let img2 = rawImg2 ? normalizeImageUrl(rawImg2, designName ? `${designName}-2` : '') : '';

      const cardData = {
        jobNo,
        designNo: designName,
        designName: designName,
        category,
        department: 'digital_print',
        fabric,
        pcs,
        colors,
        panna,
        pass,
        speed,
        designer,
        colourMatching,
        paperType,
        temperature,
        fusingTemp,
        consumption,
        totalMtr,
        top,
        sleeve,
        bottom,
        dupatta,
        cut,
        setCopy,
        expTime,
        date,
        party: partyCode || companyName,
        billTo: companyName || partyCode,
        shipTo: companyName || partyCode,
        status: 'Pending',
        printStatus: 'Printing Pending',
        fusingStatus: 'Fusing Pending',
        deliveryStatus: 'Delivery Pending',
        productionStage: 'Order Received',
        note1: note,
        emergencyNotes: `[Order placed by ${creatorString}]`,
        createdBy: creatorString,
        createdByName: creatorString,
        imageUrl1: img1,
        imageUrl2: img2,
        imageUrl: img1,
        auditTrail: [
          {
            performedBy: creatorString,
            performedByName: creatorString,
            action: 'CREATE',
            timestamp: new Date(),
            details: `Online Order placed by ${creatorString} (Qty: ${pcs} pcs, Design: ${designName}, Fabric: ${fabric}, Total Mtr: ${totalMtr || '0'}m)`,
            changesSummary: 'Job Card created via Client Portal'
          }
        ]
      };

      await syncDesignImage(cardData).catch(e => logger.warn('syncDesignImage failed in client order: %s', e.message));
      if (cardData.imageUrl1 && !cardData.imageUrl) cardData.imageUrl = cardData.imageUrl1;

      const card = await db.JobCard.create(cardData);
      createdCards.push(card);

      publishActivity({
        actorName: creatorString,
        action: 'CREATE',
        module: 'Job Card',
        recordRef: card.jobNo,
        recordId: card._id,
        permissionScope: 'jobcards',
        department: 'Production',
        description: `📋 **New Client Order #${card.jobNo}** placed by **${creatorString}** | Design: **${designName}** | Qty: **${pcs} pcs** (${totalMtr ? `${totalMtr}m` : '0m'}) | Fabric: **${fabric}**.`
      }).catch(e => logger.warn('publishActivity failed on client order: %s', e.message));

      emitSocketEvent(req, 'job-created', card);
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdCards.length} Job Card(s).`,
      jobCards: createdCards
    });
  } catch (err) {
    logger.error('createClientBulkOrder error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to process client orders.' });
  }
};

const updateJobCard = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body._id;
    delete body.id;
    delete body.created_date_time;
    delete body.modified_date_time;
    delete body.__v;
    if (!body.orderChatRoomId) delete body.orderChatRoomId;

    if (body.date) body.date = normalizeDateStr(body.date);
    if (body.printDate) body.printDate = normalizeDateStr(body.printDate);
    if (body.fusingDate) body.fusingDate = normalizeDateStr(body.fusingDate);
    if (body.deliveryDate) body.deliveryDate = normalizeDateStr(body.deliveryDate);

    let targetId = req.params.id;
    let existingCard = null;
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      existingCard = await db.JobCard.findById(targetId);
    }
    if (!existingCard) {
      existingCard = await db.JobCard.findOne({
        $or: [
          { jobNo: targetId },
          { jobNo: `JOB NO.- ${targetId}` },
          { jobNo: targetId.replace('JOB NO.- ', '') }
        ]
      });
    }
    if (!existingCard) return res.status(404).json({ error: `Job card not found for ID or Job No: ${targetId}` });
    targetId = existingCard._id;

    await syncDesignImage(body, existingCard).catch(e => logger.warn('syncDesignImage failed: %s', e.message));

    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    if (body.imageUrl1) body.imageUrl1 = normalizeImageUrl(body.imageUrl1, body.designName || body.designNo);
    if (body.imageUrl2) body.imageUrl2 = normalizeImageUrl(body.imageUrl2, body.designName ? `${body.designName}-2` : '');
    if (body.imageUrl) body.imageUrl = normalizeImageUrl(body.imageUrl, body.designName || body.designNo);

    if (body.panna && body.pass && body.totalMtr && body.machineName)
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);

    const printStatus    = body.printStatus    !== undefined ? body.printStatus    : existingCard.printStatus;
    const fusingStatus   = body.fusingStatus   !== undefined ? body.fusingStatus   : existingCard.fusingStatus;
    const deliveryStatus = body.deliveryStatus !== undefined ? body.deliveryStatus : existingCard.deliveryStatus;
    if (body.printStatus    === 'Printing Done'  && !body.printDate    && !existingCard.printDate)    body.printDate    = new Date().toISOString().split('T')[0];
    if (body.fusingStatus   === 'Fusing Done'    && !body.fusingDate   && !existingCard.fusingDate)   body.fusingDate   = new Date().toISOString().split('T')[0];
    if (body.deliveryStatus === 'Delivery Done'  && !body.deliveryDate && !existingCard.deliveryDate) body.deliveryDate = new Date().toISOString().split('T')[0];
    const editorName = req.user?.name || body.userName || body.updatedBy || 'Staff User';
    const editorId = req.user?._id || body.userId || body.updatedById;
    body.updatedBy = editorName;
    body.updatedByName = editorName;

    if (printStatus==='Printing Done' && fusingStatus==='Fusing Done' && deliveryStatus==='Delivery Done') body.status='Done';
    else if (printStatus==='Printing Done' || fusingStatus==='Fusing Done' || deliveryStatus==='Delivery Done') body.status='In Progress';
    else body.status='Pending';

    // Track detailed field diffs for Mistakes & Revision History Audit Log
    const changesArr = [];
    const fieldsToTrack = [
      ['party', 'Party Name'],
      ['billNo', 'Bill No'],
      ['designName', 'Design'],
      ['designNo', 'Design No'],
      ['fabric', 'Fabric'],
      ['totalMtr', 'Total Meters'],
      ['pcs', 'Pcs'],
      ['colors', 'Colors'],
      ['panna', 'Panna'],
      ['status', 'Status'],
      ['printStatus', 'Print Status'],
      ['fusingStatus', 'Fusing Status'],
      ['deliveryStatus', 'Delivery Status'],
      ['machineName', 'Machine']
    ];

    fieldsToTrack.forEach(([field, label]) => {
      if (body[field] !== undefined && String(body[field]).trim() !== String(existingCard[field] || '').trim()) {
        changesArr.push(`${label}: '${existingCard[field] || 'None'}' ➔ '${body[field]}'`);
      }
    });

    const auditEntry = {
      performedBy: editorName,
      performedByName: editorName,
      performedById: String(editorId || ''),
      action: changesArr.length > 0 ? 'UPDATE' : 'EDIT',
      timestamp: new Date(),
      details: changesArr.length > 0 ? `Changed: ${changesArr.join('; ')}` : 'Updated Job Card details',
      changesSummary: changesArr.join('; ')
    };

    // Append to auditTrail array in MongoDB
    const updatedAuditTrail = Array.isArray(existingCard.auditTrail) ? [...existingCard.auditTrail, auditEntry] : [auditEntry];
    body.auditTrail = updatedAuditTrail;

    const card = await db.JobCard.findByIdAndUpdate(targetId, body, { new:true, runValidators:true }).lean();

    const edNo = card.designName || card.designNo || 'N/A';
    const efab = card.fabric || 'N/A';
    const emtr = card.totalMtr ? `${card.totalMtr}m` : '0m';

    publishActivity({
      actorId: editorId,
      actorName: editorName,
      action: 'UPDATE',
      module: 'Job Card',
      recordRef: card.jobNo || 'N/A',
      recordId: card._id,
      permissionScope: 'jobcards',
      department: 'Production',
      description: `🔄 **Job Card #${card.jobNo || ''}** updated for party **"${card.party || 'Client'}"** | Design: **${edNo}** | Fabric: **${efab}** (${emtr}) | Status: **'${card.status}'** (Print: ${card.printStatus || 'Pending'}, Fusing: ${card.fusingStatus || 'Pending'}, Delivery: ${card.deliveryStatus || 'Pending'}) by **${editorName}**.`
    }).catch(e => logger.warn('publishActivity failed on job card update: %s', e.message));

    emitSocketEvent(req, 'job-updated', card);

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
    emitSocketEvent(req, 'job-deleted', { id: req.params.id });
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
    // Use aggregation to extract numeric part and find max — avoids full collection transfer to Node
    const [result] = await db.JobCard.aggregate([
      { $addFields: {
          jobNoNum: { $convert: {
            input: { $let: {
              vars: { m: { $regexFind: { input: '$jobNo', regex: '\\d+' } } },
              in: '$$m.match'
            }},
            to: 'int', onError: 0, onNull: 0
          }}
      }},
      { $group: { _id: null, maxNo: { $max: '$jobNoNum' } } }
    ]);
    const maxNo = result ? Math.max(result.maxNo, startingNo - 1) : startingNo - 1;
    res.json({ nextJobNo: `JOB NO.- ${maxNo+1}` });
  } catch (err) {
    logger.error('getNextJobCardNumber error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Render Job Card PDF A5 Page (Image 2 Exact Spec Layout) ──────────────────
async function renderJobCardA5Page(doc, jobCard, activeLogo) {
  const PW = 419.53, PH = 595.28;
  const ML = 32, MR = 10;
  const CW = PW - ML - MR; // ~377.53 pt

  const formatDateStr = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return String(d);
    }
  };

  // Helper to extract design names
  const areDesignsEquivalent = (a, b) => {
    if (!a || !b) return false;
    const s1 = String(a).trim().toUpperCase();
    const s2 = String(b).trim().toUpperCase();
    if (s1 === s2) return true;
    const clean1 = s1.replace(/^(ED|PKD)[-\s]?/i, '').trim();
    const clean2 = s2.replace(/^(ED|PKD)[-\s]?/i, '').trim();
    return clean1 && clean2 && clean1 === clean2;
  };

  const cleanDesignNameString = (str) => {
    if (!str || typeof str !== 'string') return '';
    const parts = str.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) return str.trim();
    const uniqueList = [];
    for (const p of parts) {
      const existingIdx = uniqueList.findIndex(u => areDesignsEquivalent(u, p));
      if (existingIdx === -1) {
        uniqueList.push(p);
      } else {
        if (/^(ED|PKD)-/i.test(p) && !/^(ED|PKD)-/i.test(uniqueList[existingIdx])) {
          uniqueList[existingIdx] = p;
        }
      }
    }
    return uniqueList.join(', ');
  };

  const extractNames = (str) => {
    if (!str || typeof str !== 'string') return [];
    const cleaned = cleanDesignNameString(str);
    return cleaned.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
  };

  // Resolve Design Images
  const { normalizeImageUrl } = require('../utils/imageUrlHelper');
  let imageUrl1 = jobCard.imageUrl1 || jobCard.imageUrl || jobCard.proofing?.artworkUrl || '';
  let imageUrl2 = jobCard.imageUrl2 || '';
  const keyStr = jobCard.designName || jobCard.designNo || '';
  const names = extractNames(keyStr);

  if (!imageUrl1 && names[0]) {
    const cleanName = names[0].replace(/^ED-/i, '');
    try {
      const design1 = await db.Design.findOne({
        $or: [
          { designName: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { designNo: { $regex: `^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        ]
      }).lean();
      if (design1 && (design1.imageUrl || design1.imageUrl2)) {
        imageUrl1 = design1.imageUrl || design1.imageUrl2;
      }
    } catch (e) {}
  }
  if (!imageUrl1 && names[0]) {
    imageUrl1 = normalizeImageUrl('', names[0]);
  }

  if (names.length >= 2 && names[1]) {
    const cleanName2 = names[1].replace(/^ED-/i, '');
    try {
      const design2 = await db.Design.findOne({
        $or: [
          { designName: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { designNo: { $regex: `^(ED-)?${cleanName2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        ]
      }).lean();
      if (design2) imageUrl2 = design2.imageUrl || design2.imageUrl2 || '';
    } catch (e) {}
    if (!imageUrl2) {
      imageUrl2 = normalizeImageUrl('', names[1]);
    }
  }

  const [imgBuf1, imgBuf2] = await Promise.all([getImageBuffer(imageUrl1), getImageBuffer(imageUrl2)]);

  // 1. PUNCH HOLE GUIDE (Left Margin)
  const punchX = 14;
  const centerY = PH / 2;
  doc.circle(punchX, 130, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();
  doc.moveTo(8, centerY).lineTo(20, centerY).strokeColor('#9ca3af').lineWidth(1.2).stroke();
  doc.fillColor('#9ca3af').fontSize(5).font('Helvetica-Bold')
    .text('PUNCH', 4, centerY + 4, { width: 20, align: 'center' });
  doc.circle(punchX, 450, 7).strokeColor('#9ca3af').lineWidth(0.8).stroke();

  let curY = 10;

  // 2. HEADER BOX
  const headerH = 36;
  doc.rect(ML, curY, CW, headerH).strokeColor('#000000').lineWidth(1.5).stroke();

  const logoW = 85, logoH = 28;
  if (activeLogo) {
    try {
      doc.image(activeLogo, ML + 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
      doc.image(activeLogo, ML + CW - logoW - 5, curY + 4, { height: logoH, fit: [logoW, logoH] });
    } catch (e) {}
  }

  doc.moveTo(ML + logoW + 10, curY).lineTo(ML + logoW + 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();
  doc.moveTo(ML + CW - logoW - 10, curY).lineTo(ML + CW - logoW - 10, curY + headerH).strokeColor('#000000').lineWidth(1.5).stroke();

  doc.fillColor('#000000').fontSize(13.5).font('Helvetica-Bold')
    .text('ELITE DIGITAL', ML + logoW + 10, curY + 3, { width: CW - 2 * (logoW + 10), align: 'center' });

  const mName = (jobCard.machineName || '').trim().toUpperCase();
  const mBg = mName === 'GRANDO' ? '#0b5394' : mName === 'PRINTDOT' ? '#cc0000' : '#cc0000';
  const mColor = '#ffffff';
  const badgeW = 110, badgeH = 12, badgeX = ML + (CW - badgeW) / 2;
  doc.rect(badgeX, curY + 21, badgeW, badgeH).fillAndStroke(mBg, '#000000');
  doc.fillColor(mColor).fontSize(8).font('Helvetica-Bold')
    .text(mName || 'PRINTDOT', badgeX, curY + 23, { width: badgeW, align: 'center' });

  curY += headerH + 1;

  // 3. MAIN FIELDS GRID TABLE
  const colW_Label = 44;
  const colW_Val = (CW - 3 * colW_Label) / 3;
  const rowH = 13.5;

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
      doc.rect(x, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold')
        .text(lbl, x + 2, curY + 3, { width: colW_Label - 4, lineBreak: false });
      x += colW_Label;

      doc.rect(x, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text(String(val || ''), x + 3, curY + 3, { width: colW_Val - 5, lineBreak: false });
      x += colW_Val;
    });
    curY += rowH;
  });

  // Row 6: SLEEVE, CUT, TOTAL MTR Header
  let x6 = ML;
  doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('SLEEVE :', x6 + 2, curY + 3, { lineBreak: false });
  x6 += colW_Label;
  doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.sleeve || ''), x6 + 3, curY + 3, { lineBreak: false });
  x6 += colW_Val;

  doc.rect(x6, curY, colW_Label, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('CUT :', x6 + 2, curY + 3, { lineBreak: false });
  x6 += colW_Label;
  doc.rect(x6, curY, colW_Val, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.cut || ''), x6 + 3, curY + 3, { lineBreak: false });
  x6 += colW_Val;

  const totalHeaderW = colW_Label + colW_Val;
  doc.rect(x6, curY, totalHeaderW, rowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold').text('TOTAL MTR', x6, curY + 3, { width: totalHeaderW, align: 'center' });
  curY += rowH;

  // Row 7: PARTY and TOTAL MTR Value
  let x7 = ML;
  doc.rect(x7, curY, colW_Label, rowH + 2).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('PARTY :', x7 + 2, curY + 4, { lineBreak: false });
  x7 += colW_Label;

  const partyValW = 2 * colW_Val + colW_Label;
  doc.rect(x7, curY, partyValW, rowH + 2).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text(String(jobCard.party || ''), x7 + 3, curY + 4, { lineBreak: false });
  x7 += partyValW;

  doc.rect(x7, curY, totalHeaderW, rowH + 2).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text(`: ${jobCard.totalMtr || ''}`, x7 + 4, curY + 2.5);
  curY += rowH + 3;

  // 4. DESIGN IMAGE CONTAINER
  const imgAreaH = 125;
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

  // 5. NOTES CONTAINER
  const noteH = 13.5;
  // NOTE 1
  doc.rect(ML, curY, CW, noteH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('NOTE 1 :', ML + 4, curY + 3);
  if (jobCard.note1) {
    doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.note1), ML + 52, curY + 3, { width: CW - 56, lineBreak: false });
  }
  curY += noteH;

  // EMRG. NOTE
  doc.rect(ML, curY, CW, noteH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#dc2626').fontSize(7.5).font('Helvetica-Bold').text('EMRG. NOTE :', ML + 4, curY + 3);
  if (jobCard.emergencyNotes) {
    doc.fillColor('#dc2626').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.emergencyNotes), ML + 75, curY + 3, { width: CW - 80, lineBreak: false });
  }
  curY += noteH;

  // NOTE 2
  doc.rect(ML, curY, CW, noteH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('NOTE 2 :', ML + 4, curY + 3);
  if (jobCard.note2) {
    doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.note2), ML + 52, curY + 3, { width: CW - 56, lineBreak: false });
  }
  curY += noteH + 1;

  // 6. PROCESS & T.P. DETAILS TABLE (Exact Image 2 Specification Grid)
  const pLabelW = 60;
  const pValW = (CW - 2 * pLabelW) / 2;
  const pRowH = 13.5;

  const procRows = [
    [['DESIGNER :', jobCard.designer || ''], ['C. M. :', jobCard.colourMatching || '']],
    [['EXP. TIME :', jobCard.expTime || ''], ['PAPER TYPE :', jobCard.paperType || '']],
    [['OPERATER:', jobCard.operatorName || ''], ['PRINT DATE :', formatDateStr(jobCard.printDate)]],
    [['ROLL NO. :', jobCard.rollNo || ''], ['PRINT METER :', jobCard.printMtr || '']],
  ];

  procRows.forEach(row => {
    let px = ML;
    row.forEach(([lbl, val]) => {
      doc.rect(px, curY, pLabelW, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold')
        .text(lbl, px + 3, curY + 3, { width: pLabelW - 5, lineBreak: false });
      px += pLabelW;

      doc.rect(px, curY, pValW, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
        .text(String(val || ''), px + 4, curY + 3, { width: pValW - 6, lineBreak: false });
      px += pValW;
    });
    curY += pRowH;
  });

  // Fusing Temp & Speed Row
  let fx = ML;
  const fLabel1W = 38, fLabel2W = 44, fVal1W = 75, fLabel3W = 44, fVal2W = CW - (fLabel1W + fLabel2W + fVal1W + fLabel3W);
  doc.rect(fx, curY, fLabel1W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('FUSING', fx, curY + 3, { width: fLabel1W, align: 'center' });
  fx += fLabel1W;

  doc.rect(fx, curY, fLabel2W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('TEMP. :', fx + 2, curY + 3, { lineBreak: false });
  fx += fLabel2W;

  doc.rect(fx, curY, fVal1W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.temperature || ''), fx, curY + 3, { width: fVal1W, align: 'center' });
  fx += fVal1W;

  doc.rect(fx, curY, fLabel3W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('SPEED :', fx + 2, curY + 3, { lineBreak: false });
  fx += fLabel3W;

  doc.rect(fx, curY, fVal2W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.speed || ''), fx, curY + 3, { width: fVal2W, align: 'center' });
  curY += pRowH;

  // Name & Date Row
  let nx = ML;
  const nLabel1W = 55, nVal1W = 100, nLabel2W = 44, nVal2W = CW - (nLabel1W + nVal1W + nLabel2W);
  doc.rect(nx, curY, nLabel1W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('NAME:', nx + 3, curY + 3, { lineBreak: false });
  nx += nLabel1W;

  doc.rect(nx, curY, nVal1W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(String(jobCard.fusingOperator || ''), nx + 3, curY + 3, { width: nVal1W - 5, lineBreak: false });
  nx += nVal1W;

  doc.rect(nx, curY, nLabel2W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('DATE :', nx + 2, curY + 3, { lineBreak: false });
  nx += nLabel2W;

  doc.rect(nx, curY, nVal2W, pRowH).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text(formatDateStr(jobCard.fusingDate), nx + 3, curY + 3, { width: nVal2W - 5, lineBreak: false });
  curY += pRowH + 1;

  // 7. T.P. METER & T.P. WESTAGE METER TABLE (Exact Image 2 Bottom Grid)
  const tpTableW = CW;
  const mainTpW = tpTableW * 0.83; // ~313.35 pt
  const westageW = tpTableW - mainTpW; // ~64.18 pt

  // Header Row
  doc.rect(ML, curY, mainTpW, 14).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('T.P. METER', ML, curY + 3, { width: mainTpW, align: 'center' });

  doc.rect(ML + mainTpW, curY, westageW, 14).strokeColor('#000000').lineWidth(0.8).stroke();
  doc.fillColor('#000000').fontSize(5.2).font('Helvetica-Bold').text('T.P. WESTAGE METER', ML + mainTpW + 1, curY + 2, { width: westageW - 2, align: 'center' });
  curY += 14;

  // 5 Grid Rows for T.P. Meter (1-5, 6-10, 11-15, 16-19, 20-23 + Westage 1-3)
  const subLabelW = 15;
  const subPairW = mainTpW / 5;
  const subValW = subPairW - subLabelW;

  const westageSubLabelW = 14;
  const westageSubValW = westageW - westageSubLabelW;

  const gridData = [
    [['1)', ''], ['6)', ''], ['11)', ''], ['16)', ''], ['20)', ''], ['1)', '']],
    [['2)', ''], ['7)', ''], ['12)', ''], ['17)', ''], ['21)', ''], ['2)', '']],
    [['3)', ''], ['8)', ''], ['13)', ''], ['18)', ''], ['22)', ''], ['3)', '']],
    [['4)', ''], ['9)', ''], ['14)', ''], ['19)', ''], ['23)', ''], ['', '']],
    [['5)', ''], ['10)', ''], ['15)', ''], ['TOTAL :-', ''], ['', ''], ['', '']]
  ];

  const tpGridRowH = 12;
  gridData.forEach((row, rIdx) => {
    let tX = ML;
    for (let cIdx = 0; cIdx < 5; cIdx++) {
      const [lbl, val] = row[cIdx];
      if (rIdx === 4 && cIdx === 3) {
        const totalSpanW = subPairW + subLabelW;
        doc.rect(tX, curY, totalSpanW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
        doc.fillColor('#000000').fontSize(6.5).font('Helvetica-Bold').text('TOTAL :-', tX, curY + 2.5, { width: totalSpanW - 3, align: 'right' });
        tX += totalSpanW;
        cIdx++;
        doc.rect(tX, curY, subValW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
        doc.fillColor('#000000').fontSize(6.5).font('Helvetica').text('', tX + 2, curY + 2.5);
        tX += subValW;
        continue;
      }

      doc.rect(tX, curY, subLabelW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(6.5).font('Helvetica-Bold').text(lbl, tX, curY + 2.5, { width: subLabelW, align: 'center' });
      tX += subLabelW;

      doc.rect(tX, curY, subValW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
      doc.fillColor('#000000').fontSize(6.5).font('Helvetica').text(val, tX + 2, curY + 2.5);
      tX += subValW;
    }

    const [wLbl, wVal] = row[5];
    doc.rect(tX, curY, westageSubLabelW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
    doc.fillColor('#000000').fontSize(6.5).font('Helvetica-Bold').text(wLbl, tX, curY + 2.5, { width: westageSubLabelW, align: 'center' });
    tX += westageSubLabelW;

    doc.rect(tX, curY, westageSubValW, tpGridRowH).strokeColor('#000000').lineWidth(0.8).stroke();
    doc.fillColor('#000000').fontSize(6.5).font('Helvetica').text(wVal, tX + 2, curY + 2.5);

    curY += tpGridRowH;
  });
}

const downloadJobCardPdf = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const param = req.params.id;
    let jobCard = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      jobCard = await db.JobCard.findById(param).lean();
    }
    if (!jobCard) {
      const cleanJobNo = String(param).replace(/^JC-/i, '').replace(/^JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
      const num = parseInt(cleanJobNo, 10);
      const query = { $or: [{ jobNo: cleanJobNo }, { jobNo: String(cleanJobNo) }] };
      if (!isNaN(num)) query.$or.push({ jobNo: num });
      jobCard = await db.JobCard.findOne(query).lean();
    }

    if (!jobCard) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const logoPath = path.join(__dirname, 'DigitalLogo.png');
    const logoFallback = path.join(__dirname, 'Logo.png');
    const activeLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(logoFallback) ? logoFallback : null);

    const doc = new PDFDocument({ margin: 0, size: 'A5', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="JobCard_${jobCard.jobNo || 'preview'}.pdf"`);
    doc.pipe(res);

    await renderJobCardA5Page(doc, jobCard, activeLogo);

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

    const logoPath = path.join(__dirname, 'DigitalLogo.png');
    const logoFallback = path.join(__dirname, 'Logo.png');
    const activeLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(logoFallback) ? logoFallback : null);

    const doc = new PDFDocument({ margin: 0, size: 'A5', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Combined_Job_Cards_${jobCards.length}_Cards.pdf"`);
    doc.pipe(res);

    for (let jIdx = 0; jIdx < jobCards.length; jIdx++) {
      if (jIdx > 0) {
        doc.addPage({ size: 'A5', margin: 0 });
      }
      await renderJobCardA5Page(doc, jobCards[jIdx], activeLogo);
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

    emitSocketEvent(req, 'job-stage-updated', { jobCardId: id, jobNo: card.jobNo, newStage, prevStage });
    emitSocketEvent(req, 'job-updated', card);

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
    emitSocketEvent(req, 'proof-status-updated', { jobCardId: id, jobNo: card.jobNo, status: approvalStatus });
    emitSocketEvent(req, 'job-updated', card);
    res.json({ success: true, data: card });
  } catch (err) {
    logger.error('updateProofingStatus error: %o', err);
    res.status(500).json({ error: err.message });
  }
};

const syncFusingFromDelivery = async (req, res) => {
  try {
    const { cardId } = req.body || {};
    const filter = cardId ? { _id: cardId } : {
      $or: [
        { deliveredMtr: { $gt: 0 } },
        { 'invoices.0': { $exists: true } },
        { deliveryStatus: 'Delivery Done' }
      ]
    };

    const cards = await db.JobCard.find(filter);
    let updatedCount = 0;

    for (const card of cards) {
      let delMtr = card.deliveredMtr || 0;
      if (!delMtr && Array.isArray(card.invoices) && card.invoices.length > 0) {
        delMtr = card.invoices.reduce((sum, inv) => sum + (Number(inv.meters) || 0), 0);
        delMtr = Math.round(delMtr * 100) / 100;
      }
      if (!delMtr && card.deliveryStatus === 'Delivery Done') {
        const m = String(card.totalMtr || card.consumption || '0').match(/[\d.]+/);
        if (m) delMtr = parseFloat(m[0]);
      }

      let invDate = card.deliveryDate || '';
      if (!invDate && Array.isArray(card.invoices) && card.invoices.length > 0) {
        const sorted = [...card.invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sorted[0]?.date) {
          const dt = new Date(sorted[0].date);
          if (!isNaN(dt.getTime())) {
            invDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          }
        }
      }

      let modified = false;

      // 1. Write delivery mtr in Fusing mtr
      if (delMtr > 0) {
        const delMtrStr = String(delMtr);
        if (card.fusingMtr !== delMtrStr) {
          card.fusingMtr = delMtrStr;
          modified = true;
        }
      }

      // 2. Change fusing status to Fusing Done
      if (delMtr > 0 || card.deliveryStatus === 'Delivery Done') {
        if (card.fusingStatus !== 'Fusing Done') {
          card.fusingStatus = 'Fusing Done';
          modified = true;
        }
      }

      // 3. Date put same as in invoice
      if (invDate && card.fusingDate !== invDate) {
        card.fusingDate = invDate;
        modified = true;
      }

      if (modified) {
        if (card.deliveryStatus === 'Delivery Done' && card.status !== 'Done') {
          card.status = 'Done';
        }
        await card.save();
        updatedCount++;
      }
    }

    emitSocketEvent(req, 'jobcard-fusing-synced', { updatedCount });
    res.json({
      success: true,
      message: `Successfully synced ${updatedCount} job card(s) with delivery meters, status, and invoice dates.`,
      updatedCount
    });
  } catch (err) {
    logger.error('syncFusingFromDelivery error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to sync fusing from delivery' });
  }
};

module.exports = {
  getAllJobCards, getJobCard, createJobCard, createClientBulkOrder, updateJobCard,
  deleteJobCard, calcExpTimeEndpoint, getNextJobCardNumber, downloadJobCardPdf,
  downloadBulkJobCardsPdf, calculatePrintCost, updateProductionStage, updateProofingStatus,
  syncFusingFromDelivery
};
