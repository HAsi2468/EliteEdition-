const db = require('../db/models');
const logger = require('../config/logger');
const { normalizeImageUrl } = require('../utils/imageUrlHelper');

const getAll = async (req, res) => {
  try {
    const { search, category, colors, status, page = 1, limit = 50, sortBy, sortOrder, department, party } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (category && category !== 'All') {
      const escaped = String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.category = { $regex: `^${escaped}$`, $options: 'i' };
    }
    if (colors && colors !== 'All') filter.colors = { $regex: colors, $options: 'i' };
    if (party && party !== 'All') {
      const partyItems = String(party)
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      const partyRegexes = partyItems.map(p => {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^\\s*${escaped}\\s*$`, 'i');
      });

      // Find designs used in this party's job cards
      let jcDesignNames = [];
      try {
        const jcDesigns = await db.JobCard.distinct('designName', {
          $or: [
            { party: { $in: partyRegexes } },
            { partyCode: { $in: partyRegexes } }
          ]
        });
        jcDesignNames = (jcDesigns || []).map(n => String(n || '').trim()).filter(Boolean);
      } catch (e) {
        // ignore error if JobCard model fails
      }

      const partyOr = [
        { parties: { $in: partyRegexes } },
        { party: { $in: partyRegexes } }
      ];
      if (jcDesignNames.length > 0) {
        partyOr.push({ designName: { $in: jcDesignNames } });
      }

      const partyFilter = { $or: partyOr };
      if (!filter.$and) filter.$and = [];
      filter.$and.push(partyFilter);
    }

    let deptOr = null;
    if (department === 'stitching') {
      deptOr = [
        { department: 'stitching' },
        { category: { $regex: 'stitching', $options: 'i' } },
        { designName: { $regex: '^PKD-', $options: 'i' } }
      ];
    } else if (department === 'digital_print') {
      filter.department = { $ne: 'stitching' };
      if (!filter.category) {
        filter.category = { $ne: 'Stitching' };
      }
      filter.designName = { $regex: '^ED-', $options: 'i' };
    }

    if (deptOr) {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: deptOr });
    }

    if (search) {
      const searchOr = [
        { designName:     { $regex: search, $options: 'i' } },
        { designerName:   { $regex: search, $options: 'i' } },
        { fabricName:     { $regex: search, $options: 'i' } },
        { colourMatching: { $regex: search, $options: 'i' } },
        { category:       { $regex: search, $options: 'i' } },
        { colors:         { $regex: search, $options: 'i' } },
        { parties:        { $regex: search, $options: 'i' } },
        { partySkuId:     { $regex: search, $options: 'i' } },
      ];
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: searchOr });
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

    const normalizedDocs = docs.map(d => ({
      ...d,
      imageUrl: normalizeImageUrl(d.imageUrl, d.designName),
      imageUrl2: normalizeImageUrl(d.imageUrl2, d.designName ? `${d.designName}-2` : ''),
    }));

    res.json({ data: normalizedDocs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    logger.error('design.getAll error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getOne = async (req, res) => {
  try {
    const doc = await db.Design.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Design not found' });
    doc.imageUrl = normalizeImageUrl(doc.imageUrl, doc.designName);
    doc.imageUrl2 = normalizeImageUrl(doc.imageUrl2, doc.designName ? `${doc.designName}-2` : '');
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.imageUrl) body.imageUrl = normalizeImageUrl(body.imageUrl, body.designName);
    if (body.imageUrl2) body.imageUrl2 = normalizeImageUrl(body.imageUrl2, body.designName ? `${body.designName}-2` : '');
    if (body.parties !== undefined) {
      body.parties = Array.isArray(body.parties)
        ? body.parties.map(p => String(p).trim()).filter(Boolean)
        : (typeof body.parties === 'string' && body.parties.trim() ? [body.parties.trim()] : []);
    }
    const doc = await db.Design.create(body);
    const result = doc.toObject ? doc.toObject() : doc;
    result.imageUrl = normalizeImageUrl(result.imageUrl, result.designName);
    result.imageUrl2 = normalizeImageUrl(result.imageUrl2, result.designName ? `${result.designName}-2` : '');
    res.status(201).json(result);
  } catch (err) {
    logger.error('design.create error: %o', err);
    if (err.code === 11000) return res.status(400).json({ error: `Design name "${req.body.designName}" already exists.` });
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.imageUrl) body.imageUrl = normalizeImageUrl(body.imageUrl, body.designName);
    if (body.imageUrl2) body.imageUrl2 = normalizeImageUrl(body.imageUrl2, body.designName ? `${body.designName}-2` : '');
    if (body.parties !== undefined) {
      body.parties = Array.isArray(body.parties)
        ? body.parties.map(p => String(p).trim()).filter(Boolean)
        : (typeof body.parties === 'string' && body.parties.trim() ? [body.parties.trim()] : []);
    }
    const doc = await db.Design.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ error: 'Design not found' });
    doc.imageUrl = normalizeImageUrl(doc.imageUrl, doc.designName);
    doc.imageUrl2 = normalizeImageUrl(doc.imageUrl2, doc.designName ? `${doc.designName}-2` : '');
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

// Get next sequential design number (PKD-1001 for stitching, ED-709 for digital_print)
const getNextDesignNumber = async (req, res) => {
  try {
    const { department = 'digital_print' } = req.query;
    const prefix = department === 'stitching' ? 'PKD' : 'ED';

    const filter = department === 'stitching'
      ? { $or: [{ department: 'stitching' }, { category: /stitching/i }, { designName: /^PKD/i }] }
      : { department: { $ne: 'stitching' }, designName: /^ED/i };

    const designs = await db.Design.find(filter, { designName: 1 }).lean();

    let maxNo = department === 'stitching' ? 1000 : 0;
    designs.forEach(d => {
      if (!d.designName) return;
      const match = String(d.designName).match(new RegExp(`^${prefix}[-_\\s]*(\\d+)`, 'i'));
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
    const rawCats = await db.Design.distinct('category');
    const defaultCats = [
      'SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC',
      'Cotton', 'Polyester', 'Silk', 'Stitching', 'Digital Print'
    ];
    const combined = new Set();
    [...defaultCats, ...(rawCats || [])].forEach(c => {
      if (c && typeof c === 'string' && c.trim()) {
        combined.add(c.trim());
      }
    });
    const sorted = Array.from(combined).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    res.json(sorted);
  } catch (err) {
    logger.error('design.getCategories error: %o', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Bulk Import PKD Orders with duplicate prevention
const importPKDOrders = async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for import' });
    }

    // Fetch existing designs to perform fast in-memory duplicate check
    const existingDesigns = await db.Design.find({}, { designName: 1, imageUrl: 1 }).lean();
    const existingNameSet = new Set(existingDesigns.map(d => (d.designName || '').toLowerCase().trim()));
    const existingUrlSet = new Set(existingDesigns.map(d => (d.imageUrl || '').trim()).filter(Boolean));

    const toCreate = [];
    const skippedDetails = [];

    items.forEach((item, index) => {
      let rawOrderNo = String(item.orderNo || item.designName || '').trim();
      let rawPhoto = String(item.photo || item.imageUrl || '').trim();

      if (!rawOrderNo) {
        skippedDetails.push({ row: index + 1, orderNo: 'N/A', reason: 'Missing Order No' });
        return;
      }

      // System Naming Normalization: e.g. "1001" -> "PKD-1001", "pkd 1002" -> "PKD-1002"
      let normalizedName = rawOrderNo.toUpperCase();
      if (!normalizedName.startsWith('PKD-')) {
        const numOnly = normalizedName.replace(/[^0-9]/g, '');
        if (numOnly && !normalizedName.startsWith('ED')) {
          normalizedName = `PKD-${numOnly || normalizedName}`;
        } else if (!normalizedName.includes('-')) {
          normalizedName = `PKD-${normalizedName}`;
        }
      }

      const lowerName = normalizedName.toLowerCase();

      // Check Name Duplicate
      if (existingNameSet.has(lowerName)) {
        skippedDetails.push({ row: index + 1, orderNo: rawOrderNo, normalizedName, reason: `Design Name "${normalizedName}" already exists` });
        return;
      }

      // Check Image Duplicate (if photo provided)
      if (rawPhoto && existingUrlSet.has(rawPhoto)) {
        skippedDetails.push({ row: index + 1, orderNo: rawOrderNo, normalizedName, reason: `Image URL already exists in system` });
        return;
      }

      // Add to set to prevent internal duplicates within the same batch upload
      existingNameSet.add(lowerName);
      if (rawPhoto) existingUrlSet.add(rawPhoto);

      toCreate.push({
        designName: normalizedName,
        imageUrl: rawPhoto,
        department: 'stitching',
        category: 'Stitching',
        status: 'Active',
        notes: `Imported via PKD Orders Sheet (${new Date().toLocaleDateString('en-IN')})`
      });
    });

    let createdDocs = [];
    if (toCreate.length > 0) {
      createdDocs = await db.Design.insertMany(toCreate);
    }

    res.json({
      success: true,
      createdCount: createdDocs.length,
      skippedCount: skippedDetails.length,
      skippedDetails,
      message: `Successfully imported ${createdDocs.length} PKD Orders (${skippedDetails.length} duplicates skipped).`
    });
  } catch (err) {
    logger.error('design.importPKDOrders error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to import PKD orders' });
  }
};

module.exports = { getAll, getOne, create, update, remove, getCategories, getNextDesignNumber, importPKDOrders };
