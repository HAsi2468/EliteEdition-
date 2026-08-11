const db = require('../db/models');
const logger = require('../config/logger');

const getAll = async (req, res) => {
  try {
    const { search, category, colors, status, page = 1, limit = 50, sortBy, sortOrder, department } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (category && category !== 'All') filter.category = category;
    if (colors && colors !== 'All') filter.colors = { $regex: colors, $options: 'i' };

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

    if (search) {
      const searchOr = [
        { designName:     { $regex: search, $options: 'i' } },
        { designerName:   { $regex: search, $options: 'i' } },
        { fabricName:     { $regex: search, $options: 'i' } },
        { colourMatching: { $regex: search, $options: 'i' } },
        { category:       { $regex: search, $options: 'i' } },
        { colors:         { $regex: search, $options: 'i' } },
      ];
      if (deptOr) {
        filter.$and = [{ $or: deptOr }, { $or: searchOr }];
      } else {
        filter.$or = searchOr;
      }
    } else if (deptOr) {
      filter.$or = deptOr;
    }
    const skip = (Number(page) - 1) * Number(limit);
    let sort = { designName: -1 };
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'createdAt') {
        sort = { createdAt: order, _id: order };
      } else {
        sort = { [sortBy]: order, _id: order };
      }
    }
    const [docs, total] = await Promise.all([
      db.Design.find(filter).collation({ locale: "en_US", numericOrdering: true }).sort(sort).skip(skip).limit(Number(limit)).lean(),
      db.Design.countDocuments(filter),
    ]);
    res.json({ data: docs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    logger.error('design.getAll error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getOne = async (req, res) => {
  try {
    const doc = await db.Design.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Design not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  try {
    const doc = await db.Design.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    logger.error('design.create error: %o', err);
    if (err.code === 11000) return res.status(400).json({ error: `Design name "${req.body.designName}" already exists.` });
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  try {
    const doc = await db.Design.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ error: 'Design not found' });
    res.json(doc);
  } catch (err) {
    logger.error('design.update error: %o', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  try {
    const doc = await db.Design.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Design not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get next sequential design number (PKD-1001, PKD-1002 for stitching, ED-1, ED-2 for digital_print)
const getNextDesignNumber = async (req, res) => {
  try {
    const { department = 'stitching' } = req.query;
    const prefix = department === 'stitching' ? 'PKD' : 'ED';

    const filter = department === 'stitching'
      ? { $or: [{ department: 'stitching' }, { category: /stitching/i }, { designName: /^PKD-/i }] }
      : { department: { $ne: 'stitching' }, designName: /^ED-/i };

    const designs = await db.Design.find(filter, { designName: 1 }).lean();

    let maxNo = department === 'stitching' ? 1000 : 0;
    designs.forEach(d => {
      if (!d.designName) return;
      const match = String(d.designName).match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });

    res.json({ nextDesignNo: `${prefix}-${maxNo + 1}` });
  } catch (err) {
    logger.error('design.getNextDesignNumber error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
// Get all distinct categories for filter dropdown
const getCategories = async (req, res) => {
  try {
    const cats = await db.Design.distinct('category');
    res.json(cats.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getAll, getOne, create, update, remove, getCategories, getNextDesignNumber };
