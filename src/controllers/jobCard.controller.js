const db = require('../db/models');
const logger = require('../config/logger');

// ─── Speed tables (same as Apps Script) ─────────────────────────────────────
const SPEED_GRANDO = {
  36: {1:281,2:168,4:101,6:67,8:50},
  38: {1:266,2:160,4:96, 6:64,8:48},
  42: {1:240,2:144,4:86, 6:58,8:43},
  44: {1:230,2:138,4:82, 6:55,8:41},
  46: {1:220,2:132,4:79, 6:53,8:39},
  58: {1:174,2:104,4:62, 6:41,8:31},
};
const SPEED_PRINTDOT = {
  36: {1:841, 2:503, 4:299, 6:198, 8:150},
  38: {1:797, 2:476, 4:284, 6:188, 8:142},
  42: {1:721, 2:431, 4:257, 6:170, 8:129},
  44: {1:688, 2:411, 4:245, 6:162, 8:123},
  46: {1:658, 2:393, 4:234, 6:155, 8:117},
  58: {1:522, 2:312, 4:186, 6:123, 8:93},
};

function calcExpTime(panna, passText, totalMtr, machineName) {
  const pannaMatch = String(panna || '').match(/\d+/);
  const pannaNum = pannaMatch ? Number(pannaMatch[0]) : null;
  const passMatch = String(passText || '').match(/\d+/);
  const pass = passMatch ? Number(passMatch[0]) : null;
  if (!pannaNum || !pass || !totalMtr) return '';

  const mName = String(machineName || '').trim().toUpperCase();
  const table = mName === 'GRANDO' ? SPEED_GRANDO : mName === 'PRINTDOT' ? SPEED_PRINTDOT : null;
  if (!table || !table[pannaNum] || !table[pannaNum][pass]) return '';

  const speed = table[pannaNum][pass];
  const time = Number(totalMtr) / speed;
  let hours = Math.floor(time);
  let minutes = Math.round((time - hours) * 60);
  if (minutes === 60) { hours += 1; minutes = 0; }
  return `${hours}H & ${minutes}M`;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

const getAllJobCards = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50, dateStart, dateEnd } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }
    if (search) {
      filter.$or = [
        { jobNo: { $regex: search, $options: 'i' } },
        { party: { $regex: search, $options: 'i' } },
        { designNo: { $regex: search, $options: 'i' } },
        { machineName: { $regex: search, $options: 'i' } },
        { billNo: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [cards, total] = await Promise.all([
      db.JobCard.find(filter).sort({ created_date_time: -1 }).skip(skip).limit(Number(limit)).lean(),
      db.JobCard.countDocuments(filter),
    ]);
    res.json({ data: cards, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
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
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const createJobCard = async (req, res) => {
  try {
    const body = req.body;
    // Auto-calculate EXP.TIME
    if (body.panna && body.pass && body.totalMtr && body.machineName) {
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);
    }
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
    if (body.panna && body.pass && body.totalMtr && body.machineName) {
      body.expTime = calcExpTime(body.panna, body.pass, body.totalMtr, body.machineName);
    }

    const existingCard = await db.JobCard.findById(req.params.id);
    if (!existingCard) return res.status(404).json({ error: 'Job card not found' });

    // Determine final tracking states by merging input body with existing DB fields
    const printStatus = body.printStatus !== undefined ? body.printStatus : existingCard.printStatus;
    const fusingStatus = body.fusingStatus !== undefined ? body.fusingStatus : existingCard.fusingStatus;
    const deliveryStatus = body.deliveryStatus !== undefined ? body.deliveryStatus : existingCard.deliveryStatus;

    // Auto-date fill when status changes to Done
    if (body.printStatus === 'Printing Done' && !body.printDate && !existingCard.printDate) {
      body.printDate = new Date().toISOString().split('T')[0];
    }
    if (body.fusingStatus === 'Fusing Done' && !body.fusingDate && !existingCard.fusingDate) {
      body.fusingDate = new Date().toISOString().split('T')[0];
    }
    if (body.deliveryStatus === 'Delivery Done' && !body.deliveryDate && !existingCard.deliveryDate) {
      body.deliveryDate = new Date().toISOString().split('T')[0];
    }

    // Automatically set job card main status based on tracking stages
    if (printStatus === 'Printing Done' && fusingStatus === 'Fusing Done' && deliveryStatus === 'Delivery Done') {
      body.status = 'Done';
    } else if (printStatus === 'Printing Done' || fusingStatus === 'Fusing Done' || deliveryStatus === 'Delivery Done') {
      body.status = 'In Progress';
    } else {
      body.status = 'Pending';
    }

    const card = await db.JobCard.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
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
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── EXP.TIME preview endpoint ────────────────────────────────────────────────
const calcExpTimeEndpoint = async (req, res) => {
  const { panna, pass, totalMtr, machineName } = req.query;
  res.json({ expTime: calcExpTime(panna, pass, totalMtr, machineName) });
};

// ─── GET NEXT JOB CARD NUMBER ────────────────────────────────────────────────
const getNextJobCardNumber = async (req, res) => {
  try {
    const config = await db.PrintConfig.findOne({ isConfig: true });
    const startingNo = config && config.startingJobNo ? config.startingJobNo : 1;

    const cards = await db.JobCard.find({}, { jobNo: 1 }).lean();
    let maxNo = startingNo - 1;

    cards.forEach(c => {
      if (!c.jobNo) return;
      const num = Number(c.jobNo);
      if (!isNaN(num)) {
        if (num > maxNo) {
          maxNo = num;
        }
      } else {
        const match = String(c.jobNo).match(/(\d+)/);
        if (match) {
          const parsed = Number(match[1]);
          if (!isNaN(parsed) && parsed > maxNo) {
            maxNo = parsed;
          }
        }
      }
    });

    const nextNo = maxNo + 1;
    res.json({ nextJobNo: `JOB NO.- ${nextNo}` });
  } catch (err) {
    logger.error('getNextJobCardNumber error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { 
  getAllJobCards, 
  getJobCard, 
  createJobCard, 
  updateJobCard, 
  deleteJobCard, 
  calcExpTimeEndpoint,
  getNextJobCardNumber
};
