const httpStatus = require('http-status');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const db = require('../db/models');
const logger = require('../config/logger');

const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_URL || 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev').replace(/\/+$/, '');

/**
 * Authoritative multi-company brand registry (mirrors frontend companiesConfig.js).
 * Ensures every company's Job Challan PDF and UI uses its exact brand identity & colour.
 */
const COMPANY_BRANDS = {
  digital_print: {
    id: 'digital_print',
    code: 'EDP',
    name: 'Elite Digital Prints',
    subtitle: 'Digital Textile Printing & Production Division',
    primary: '#1d4ed8',
    dark: '#1e3a8a',
    tint: '#eff6ff',
    border: '#bfdbfe',
  },
  stitching: {
    id: 'stitching',
    code: 'ES',
    name: 'Elite Stitching',
    subtitle: 'Garment Stitching & Job Work Division',
    primary: '#10b981',
    dark: '#065f46',
    tint: '#ecfdf5',
    border: '#a7f3d0',
  },
  elite_edition: {
    id: 'elite_edition',
    code: 'EE',
    name: 'Elite Edition',
    subtitle: 'Wholesale & Corporate Apparel Division',
    primary: '#8b5cf6',
    dark: '#5b21b6',
    tint: '#f5f3ff',
    border: '#ddd6fe',
  },
  elite_fabtex: {
    id: 'elite_fabtex',
    code: 'EF',
    name: 'Elite Fabtex',
    subtitle: 'Fabric & Textile Processing Division',
    primary: '#f59e0b',
    dark: '#92400e',
    tint: '#fffbeb',
    border: '#fde68a',
  },
  elite_online: {
    id: 'elite_online',
    code: 'EON',
    name: 'Elite Online',
    subtitle: 'E-Commerce Operations & Fulfillment Division',
    primary: '#6366f1',
    dark: '#3730a3',
    tint: '#eef2ff',
    border: '#c7d2fe',
  },
  sobise: {
    id: 'sobise',
    code: 'SO',
    name: 'Sobise',
    subtitle: 'Fashion & Garment Manufacturing Division',
    primary: '#e11d48',
    dark: '#881337',
    tint: '#fff1f2',
    border: '#fecdd3',
  },
  ethno_wear: {
    id: 'ethno_wear',
    code: 'EW',
    name: 'Ethno wear',
    subtitle: 'Ethnic Wear & Apparel Production Division',
    primary: '#8b5a2b',
    dark: '#5c3a1a',
    tint: '#fdf8f3',
    border: '#e5cfb8',
  },
  yamunaji: {
    id: 'yamunaji',
    code: 'YJ',
    name: 'Yamunaji',
    subtitle: 'Textile & Fabric Processing Division',
    primary: '#0ea5e9',
    dark: '#075985',
    tint: '#f0f9ff',
    border: '#bae6fd',
  },
  exedp: {
    id: 'exedp',
    code: 'EXEDP',
    name: 'EXEDP',
    subtitle: 'Elite Digital Prints — Archive Division',
    primary: '#475569',
    dark: '#1e293b',
    tint: '#f8fafc',
    border: '#cbd5e1',
  },
};

function resolveCompanyBrand(rawCompany) {
  const raw = String(rawCompany || 'stitching').trim().toLowerCase();
  const clean = raw.replace(/[\s-]+/g, '_');
  if (COMPANY_BRANDS[clean]) return COMPANY_BRANDS[clean];

  for (const brand of Object.values(COMPANY_BRANDS)) {
    if (
      brand.code.toLowerCase() === raw ||
      brand.name.toLowerCase() === raw ||
      brand.name.toLowerCase().replace(/[\s-]+/g, '_') === clean
    ) {
      return brand;
    }
  }
  if (raw.includes('stitch')) return COMPANY_BRANDS.stitching;
  if (raw.includes('digital') || raw.includes('edp')) return COMPANY_BRANDS.digital_print;
  if (raw.includes('ethno')) return COMPANY_BRANDS.ethno_wear;
  if (raw.includes('sobise')) return COMPANY_BRANDS.sobise;
  if (raw.includes('fabtex')) return COMPANY_BRANDS.elite_fabtex;
  if (raw.includes('yamuna')) return COMPANY_BRANDS.yamunaji;
  if (raw.includes('online') || raw.includes('eon')) return COMPANY_BRANDS.elite_online;
  if (raw.includes('edition')) return COMPANY_BRANDS.elite_edition;
  return COMPANY_BRANDS.stitching;
}

/**
 * Normalizes Google Drive / relative R2 / HTTP CDN URLs into directly fetchable HTTPS URLs.
 */
function normalizeDesignImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  if (trimmed.includes('drive.google.com') || trimmed.includes('googleusercontent')) {
    const fileMatch = trimmed.match(/\/d\/([-\w]{20,})/) || trimmed.match(/[?&]id=([-\w]{20,})/);
    if (fileMatch && fileMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=s600`;
    }
  }

  if (!trimmed.includes('://') && !trimmed.startsWith('//')) {
    const cleanPath = trimmed.replace(/^\/+/, '');
    if (cleanPath.startsWith('uploads/')) {
      return `http://127.0.0.1:${process.env.PORT || 3001}/${cleanPath}`;
    }
    return `${R2_PUBLIC_BASE}/${cleanPath}`;
  }

  if (trimmed.startsWith('http://') && /(myntassets\.com|flixcart\.com|media-amazon\.com|r2\.dev|eliteedition\.in)/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
}

/**
 * Looks up a single design number across Design Master and Product Catalog
 * to auto-resolve its design image and basic fabric/category info.
 */
async function resolveDesignMetadata(designNo) {
  const code = String(designNo || '').trim();
  if (!code) return null;

  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRegex = new RegExp(`^${escaped}$`, 'i');

  // 1. Check Design Master (exact match first)
  let design = await db.Design.findOne({ designName: exactRegex }).lean();
  if (!design) {
    design = await db.Design.findOne({ partySkuId: exactRegex }).lean();
  }
  if (design) {
    return {
      designNo: design.designName,
      imageUrl: normalizeDesignImageUrl(design.imageUrl || design.imageUrl2 || ''),
      description: [design.category, design.fabricName, design.colors].filter(Boolean).join(' — '),
      fabricName: design.fabricName || '',
      category: design.category || '',
      source: 'design_master',
    };
  }

  // 2. Fallback to Product Catalog / InventoryProduct
  if (db.Product) {
    const prod = await db.Product.findOne({
      $or: [{ skuCode: exactRegex }, { styleCode: exactRegex }, { designNo: exactRegex }],
    }).lean();
    if (prod) {
      return {
        designNo: prod.skuCode || code,
        imageUrl: normalizeDesignImageUrl(prod.imageUrl || prod.image || ''),
        description: prod.description || prod.itemName || prod.title || '',
        fabricName: prod.fabric || '',
        category: prod.category || '',
        source: 'product_catalog',
      };
    }
  }

  return null;
}

/**
 * Generates next sequential Challan Number for a company (e.g. ES-JC-2026-0001).
 */
async function generateNextChallanNo(companyEntity) {
  const brand = resolveCompanyBrand(companyEntity);
  const year = new Date().getFullYear();
  const prefix = `${brand.code}-JC-${year}-`;

  const latest = await db.JobChallan.findOne({
    companyEntity: brand.id,
    challanNo: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
  })
    .sort({ createdAt: -1 })
    .select('challanNo')
    .lean();

  let nextSeq = 1;
  if (latest && latest.challanNo) {
    const match = latest.challanNo.match(/(\d+)$/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Fetches an image URL (remote R2/CDN/Drive or data URI) and converts it to a
 * clean JPEG buffer via Sharp so PDFKit can reliably embed WebP, PNG, AVIF, etc.
 */
async function fetchImageBufferForPdf(rawUrl) {
  const url = normalizeDesignImageUrl(rawUrl);
  if (!url) return null;

  try {
    let rawBuffer = null;
    if (url.startsWith('data:image/')) {
      const base64Part = url.split(',')[1];
      if (!base64Part) return null;
      rawBuffer = Buffer.from(base64Part, 'base64');
    } else {
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 6000,
        maxContentLength: 8 * 1024 * 1024,
        headers: { 'User-Agent': 'EliteEditionERP-PDF/1.0' },
      });
      rawBuffer = Buffer.from(resp.data);
    }

    if (!rawBuffer || rawBuffer.length === 0) return null;

    // Normalize via sharp to crisp JPEG thumbnail (safe for PDFKit)
    const jpegBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(180, 180, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 84 })
      .toBuffer();

    return jpegBuffer;
  } catch (err) {
    logger.warn(`[JobChallan PDF] Could not embed image (${url}): ${err.message}`);
    return null;
  }
}

/**
 * GET /v1/job-challans/next-number?companyEntity=stitching
 */
const getNextChallanNumber = async (req, res) => {
  try {
    const brand = resolveCompanyBrand(req.query.companyEntity);
    const nextChallanNo = await generateNextChallanNo(brand.id);
    res.status(httpStatus.OK).json({
      success: true,
      companyEntity: brand.id,
      companyName: brand.name,
      companyCode: brand.code,
      nextChallanNo,
    });
  } catch (error) {
    logger.error('getNextChallanNumber error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * GET /v1/job-challans/design-lookup?q=D-1042
 * Returns matching designs with imageUrl & basic fabric/category info for autocomplete & auto-fill.
 */
const lookupDesign = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(httpStatus.OK).json({ success: true, exact: null, suggestions: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const [exact, designs] = await Promise.all([
      resolveDesignMetadata(q),
      db.Design.find({
        $or: [{ designName: regex }, { partySkuId: regex }, { fabricName: regex }],
      })
        .select('designName imageUrl imageUrl2 fabricName category colors partySkuId')
        .limit(12)
        .lean(),
    ]);

    const suggestions = designs.map((d) => ({
      designNo: d.designName,
      imageUrl: normalizeDesignImageUrl(d.imageUrl || d.imageUrl2 || ''),
      description: [d.category, d.fabricName, d.colors].filter(Boolean).join(' — '),
      fabricName: d.fabricName || '',
      category: d.category || '',
    }));

    res.status(httpStatus.OK).json({
      success: true,
      exact,
      suggestions,
    });
  } catch (error) {
    logger.error('lookupDesign error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * GET /v1/job-challans
 */
const listJobChallans = async (req, res) => {
  try {
    const brand = resolveCompanyBrand(req.query.companyEntity);
    const { search, status, challanType, limit = 100 } = req.query;

    const filter = { companyEntity: brand.id };
    if (status && status !== 'ALL') filter.status = status;
    if (challanType && challanType !== 'ALL') filter.challanType = challanType;

    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { challanNo: regex },
        { 'party.name': regex },
        { refLotNo: regex },
        { processType: regex },
        { 'items.designNo': regex },
        { 'items.description': regex },
      ];
    }

    const challans = await db.JobChallan.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 100, 300))
      .lean();

    const stats = challans.reduce(
      (acc, c) => {
        acc.totalChallans += 1;
        if (c.status === 'ISSUED' || c.status === 'PARTIAL_RECEIVED') acc.activeCount += 1;
        if (c.status === 'COMPLETED') acc.completedCount += 1;
        acc.totalQty += Number(c.totalQty) || 0;
        acc.totalDesigns += Number(c.totalDesigns) || 0;
        return acc;
      },
      { totalChallans: 0, activeCount: 0, completedCount: 0, totalQty: 0, totalDesigns: 0 }
    );

    res.status(httpStatus.OK).json({
      success: true,
      company: brand,
      stats,
      data: challans,
    });
  } catch (error) {
    logger.error('listJobChallans error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * POST /v1/job-challans
 */
const createJobChallan = async (req, res) => {
  try {
    const body = req.body || {};
    const brand = resolveCompanyBrand(body.companyEntity);

    if (!body.party || !String(body.party.name || '').trim()) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'Party / Karigar name is required.' });
    }

    const rawItems = Array.isArray(body.items) ? body.items.filter((i) => i && String(i.designNo || '').trim()) : [];
    if (rawItems.length === 0) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'At least one Design Number item row is required.' });
    }

    // Auto-resolve missing design images from Design Master / Product Catalog
    const enrichedItems = await Promise.all(
      rawItems.map(async (item) => {
        let imageUrl = normalizeDesignImageUrl(item.designImageUrl || '');
        let description = String(item.description || '').trim();
        if (!imageUrl || !description) {
          const meta = await resolveDesignMetadata(item.designNo);
          if (meta) {
            if (!imageUrl && meta.imageUrl) imageUrl = meta.imageUrl;
            if (!description && meta.description) description = meta.description;
          }
        }
        return {
          designNo: String(item.designNo).trim(),
          designImageUrl: imageUrl,
          description,
          processType: String(item.processType || body.processType || '').trim(),
          sizeRatio: String(item.sizeRatio || '').trim(),
          qty: Number(item.qty) || 0,
          receivedQty: Number(item.receivedQty) || 0,
          unit: String(item.unit || 'Pcs').trim(),
          rate: Number(item.rate) || 0,
          remarks: String(item.remarks || '').trim(),
        };
      })
    );

    const challanNo = String(body.challanNo || '').trim() || (await generateNextChallanNo(brand.id));

    const doc = await db.JobChallan.create({
      companyEntity: brand.id,
      companyName: brand.name,
      companyCode: brand.code,
      challanNo,
      challanDate: body.challanDate || new Date().toISOString().split('T')[0],
      expectedReturnDate: body.expectedReturnDate || '',
      challanType: body.challanType === 'RECEIVE' ? 'RECEIVE' : 'ISSUE',
      status: body.status || 'ISSUED',
      party: {
        name: String(body.party.name).trim(),
        phone: String(body.party.phone || '').trim(),
        address: String(body.party.address || '').trim(),
        gstin: String(body.party.gstin || '').trim(),
      },
      processType: String(body.processType || 'Stitching').trim(),
      refLotNo: String(body.refLotNo || '').trim(),
      items: enrichedItems,
      showRateInPrint: Boolean(body.showRateInPrint),
      notes: String(body.notes || '').trim(),
      terms:
        body.terms ||
        'Goods sent for job work only (Not for Sale). Return balance fabric and rejected pieces along with finished goods.',
      createdBy: req.user?.name || req.user?.email || body.createdBy || '',
    });

    res.status(httpStatus.CREATED).json({
      success: true,
      message: `Job Challan ${doc.challanNo} created successfully.`,
      data: doc,
    });
  } catch (error) {
    logger.error('createJobChallan error: %o', error);
    if (error.code === 11000) {
      return res.status(httpStatus.CONFLICT).json({
        success: false,
        message: 'A Job Challan with this number already exists for this company.',
      });
    }
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * PUT /v1/job-challans/:id
 */
const updateJobChallan = async (req, res) => {
  try {
    const existing = await db.JobChallan.findById(req.params.id);
    if (!existing) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Job Challan not found.' });
    }

    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items.filter((i) => i && String(i.designNo || '').trim()) : null;

    if (rawItems) {
      existing.items = await Promise.all(
        rawItems.map(async (item) => {
          let imageUrl = normalizeDesignImageUrl(item.designImageUrl || '');
          let description = String(item.description || '').trim();
          if (!imageUrl || !description) {
            const meta = await resolveDesignMetadata(item.designNo);
            if (meta) {
              if (!imageUrl && meta.imageUrl) imageUrl = meta.imageUrl;
              if (!description && meta.description) description = meta.description;
            }
          }
          return {
            designNo: String(item.designNo).trim(),
            designImageUrl: imageUrl,
            description,
            processType: String(item.processType || body.processType || existing.processType || '').trim(),
            sizeRatio: String(item.sizeRatio || '').trim(),
            qty: Number(item.qty) || 0,
            receivedQty: Number(item.receivedQty) || 0,
            unit: String(item.unit || 'Pcs').trim(),
            rate: Number(item.rate) || 0,
            remarks: String(item.remarks || '').trim(),
          };
        })
      );
    }

    if (body.challanDate !== undefined) existing.challanDate = body.challanDate;
    if (body.expectedReturnDate !== undefined) existing.expectedReturnDate = body.expectedReturnDate;
    if (body.challanType !== undefined) existing.challanType = body.challanType === 'RECEIVE' ? 'RECEIVE' : 'ISSUE';
    if (body.status !== undefined) existing.status = body.status;
    if (body.processType !== undefined) existing.processType = String(body.processType).trim();
    if (body.refLotNo !== undefined) existing.refLotNo = String(body.refLotNo).trim();
    if (body.showRateInPrint !== undefined) existing.showRateInPrint = Boolean(body.showRateInPrint);
    if (body.notes !== undefined) existing.notes = String(body.notes).trim();
    if (body.terms !== undefined) existing.terms = String(body.terms).trim();
    if (body.party) {
      existing.party = {
        name: String(body.party.name || existing.party?.name || '').trim(),
        phone: String(body.party.phone ?? existing.party?.phone ?? '').trim(),
        address: String(body.party.address ?? existing.party?.address ?? '').trim(),
        gstin: String(body.party.gstin ?? existing.party?.gstin ?? '').trim(),
      };
    }

    await existing.save();

    res.status(httpStatus.OK).json({
      success: true,
      message: `Job Challan ${existing.challanNo} updated successfully.`,
      data: existing,
    });
  } catch (error) {
    logger.error('updateJobChallan error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /v1/job-challans/:id/status
 */
const updateJobChallanStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['DRAFT', 'ISSUED', 'PARTIAL_RECEIVED', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid status.' });
    }
    const updated = await db.JobChallan.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Job Challan not found.' });
    }
    res.status(httpStatus.OK).json({ success: true, data: updated });
  } catch (error) {
    logger.error('updateJobChallanStatus error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /v1/job-challans/:id
 */
const deleteJobChallan = async (req, res) => {
  try {
    const deleted = await db.JobChallan.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Job Challan not found.' });
    }
    res.status(httpStatus.OK).json({ success: true, message: `Job Challan ${deleted.challanNo} deleted.` });
  } catch (error) {
    logger.error('deleteJobChallan error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * GET /v1/job-challans/:id/pdf
 * Generates a brand-coloured A4 "JOB CHALLAN" PDF with embedded Design Images.
 */
const downloadJobChallanPdf = async (req, res) => {
  try {
    const challan = await db.JobChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Job Challan not found.' });
    }

    const brand = resolveCompanyBrand(challan.companyEntity || challan.companyName);
    const items = Array.isArray(challan.items) ? challan.items : [];

    // Pre-fetch and normalize all design images in parallel (re-resolve from Design Master if URL missing)
    const imageBuffers = await Promise.all(
      items.map(async (item) => {
        let imgUrl = item.designImageUrl;
        if (!imgUrl && item.designNo) {
          const meta = await resolveDesignMetadata(item.designNo);
          if (meta?.imageUrl) imgUrl = meta.imageUrl;
        }
        return fetchImageBufferForPdf(imgUrl);
      })
    );

    const fmtDate = (dStr) => {
      if (!dStr) return '—';
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const safeFileName = String(challan.challanNo || 'JobChallan').replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const margin = 36;
    const contentW = pageW - margin * 2; // 523pt

    // ── Top Brand Accent Strip ──
    doc.rect(0, 0, pageW, 8).fill(brand.primary);

    // ── Header Block ──
    const headerTop = 26;
    // Company badge square
    doc.roundedRect(margin, headerTop, 36, 36, 6).fill(brand.primary);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(brand.code, margin, headerTop + 11, { width: 36, align: 'center' });

    // Company Name & Subtitle
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(brand.name.toUpperCase(), margin + 46, headerTop + 1, { width: 280 });
    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8.5)
      .text(`${brand.subtitle} — Surat, Gujarat`, margin + 46, headerTop + 23, { width: 280 });

    // Right "JOB CHALLAN" Box (no "General"!)
    const boxW = 185;
    const boxX = margin + contentW - boxW;
    doc.roundedRect(boxX, headerTop - 2, boxW, 66, 5).lineWidth(1).strokeColor(brand.primary).stroke();
    doc.rect(boxX, headerTop - 2, boxW, 18).fill(brand.primary);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('JOB CHALLAN', boxX, headerTop + 3, { width: boxW, align: 'center' });

    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8);
    doc.text('Challan No:', boxX + 8, headerTop + 21);
    doc.text('Date:', boxX + 8, headerTop + 33);
    doc.text('Due Date:', boxX + 8, headerTop + 45);
    doc.text('Process:', boxX + 8, headerTop + 54);

    doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
    doc.text(challan.challanNo || '—', boxX + 66, headerTop + 21, { width: 112 });
    doc.text(fmtDate(challan.challanDate), boxX + 66, headerTop + 33, { width: 112 });
    doc.text(fmtDate(challan.expectedReturnDate), boxX + 66, headerTop + 45, { width: 112 });
    doc.text(challan.processType || '—', boxX + 66, headerTop + 54, { width: 112 });

    // ── Party & Challan Metadata Box ──
    const infoY = headerTop + 76;
    const infoH = 62;
    doc
      .roundedRect(margin, infoY, contentW, infoH, 5)
      .fillAndStroke(brand.tint, brand.border);

    const midX = margin + contentW * 0.58;
    doc.moveTo(midX, infoY + 6).lineTo(midX, infoY + infoH - 6).lineWidth(0.75).strokeColor(brand.border).stroke();

    const partyLabel = challan.challanType === 'RECEIVE' ? 'Received From (Party / Karigar):' : 'Issued To (Party / Karigar):';
    doc.fillColor(brand.dark).font('Helvetica-Bold').fontSize(8).text(partyLabel, margin + 10, infoY + 8);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10.5).text(challan.party?.name || '—', margin + 10, infoY + 20, { width: midX - margin - 20 });

    const partySub = [
      challan.party?.address,
      challan.party?.phone ? `Ph: ${challan.party.phone}` : '',
      challan.party?.gstin ? `GSTIN: ${challan.party.gstin}` : '',
    ]
      .filter(Boolean)
      .join('  |  ');
    doc.fillColor('#475569').font('Helvetica').fontSize(8).text(partySub || '—', margin + 10, infoY + 35, { width: midX - margin - 20, height: 22 });

    // Right Metadata Column
    const rightX = midX + 10;
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
    doc.text('Challan Type:', rightX, infoY + 9);
    doc.text('Ref / Lot No:', rightX, infoY + 22);
    doc.text('Total Designs:', rightX, infoY + 35);
    doc.text('Total Qty:', rightX, infoY + 48);

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    doc.text(challan.challanType === 'RECEIVE' ? 'Job Work Receive' : 'Job Work Issue', rightX + 74, infoY + 9);
    doc.font('Helvetica').text(challan.refLotNo || '—', rightX + 74, infoY + 22);
    doc.font('Helvetica-Bold').text(String(challan.totalDesigns || items.length), rightX + 74, infoY + 35);
    doc.fillColor(brand.dark).text(`${challan.totalQty || 0} ${items[0]?.unit || 'Pcs'}`, rightX + 74, infoY + 48);

    // ── Design & Item Table (with Embedded Design Image!) ──
    const showRate = Boolean(challan.showRateInPrint);
    const cols = showRate
      ? [
          { key: 'idx', label: '#', w: 22, align: 'center' },
          { key: 'img', label: 'Design', w: 54, align: 'center' },
          { key: 'designNo', label: 'Design No.', w: 66, align: 'left' },
          { key: 'desc', label: 'Description / Fabric', w: 122, align: 'left' },
          { key: 'size', label: 'Size / Ratio', w: 72, align: 'left' },
          { key: 'qty', label: 'Qty', w: 46, align: 'right' },
          { key: 'rate', label: 'Rate', w: 45, align: 'right' },
          { key: 'remarks', label: 'Remarks', w: 96, align: 'left' },
        ]
      : [
          { key: 'idx', label: '#', w: 24, align: 'center' },
          { key: 'img', label: 'Design', w: 56, align: 'center' },
          { key: 'designNo', label: 'Design No.', w: 74, align: 'left' },
          { key: 'desc', label: 'Description / Fabric', w: 145, align: 'left' },
          { key: 'size', label: 'Size / Ratio', w: 80, align: 'left' },
          { key: 'qty', label: 'Qty', w: 52, align: 'right' },
          { key: 'remarks', label: 'Remarks', w: 92, align: 'left' },
        ];

    const drawTableHeader = (yPos) => {
      doc.rect(margin, yPos, contentW, 22).fill(brand.dark);
      let cx = margin;
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, cx + 4, yPos + 7, { width: col.w - 8, align: col.align });
        cx += col.w;
      }
      return yPos + 22;
    };

    let y = drawTableHeader(infoY + infoH + 14);
    const rowH = 54; // Tall enough for crisp 44x44 design image thumbnail

    for (let i = 0; i < items.length; i++) {
      if (y + rowH > doc.page.height - 140) {
        doc.addPage();
        doc.rect(0, 0, pageW, 6).fill(brand.primary);
        y = drawTableHeader(24);
      }

      const item = items[i];
      const imgBuf = imageBuffers[i];

      // Alternating subtle row background
      if (i % 2 === 1) {
        doc.rect(margin, y, contentW, rowH).fill('#f8fafc');
      }
      doc.rect(margin, y, contentW, rowH).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

      let cx = margin;
      for (const col of cols) {
        // Vertical cell divider
        if (cx > margin) {
          doc.moveTo(cx, y).lineTo(cx, y + rowH).lineWidth(0.4).strokeColor('#e2e8f0').stroke();
        }

        if (col.key === 'idx') {
          doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8.5).text(String(i + 1), cx + 2, y + 21, { width: col.w - 4, align: 'center' });
        } else if (col.key === 'img') {
          const imgSize = 44;
          const imgX = cx + (col.w - imgSize) / 2;
          const imgY = y + (rowH - imgSize) / 2;
          if (imgBuf) {
            try {
              doc.image(imgBuf, imgX, imgY, { width: imgSize, height: imgSize, fit: [imgSize, imgSize], align: 'center', valign: 'center' });
              doc.rect(imgX, imgY, imgSize, imgSize).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            } catch (_) {
              doc.roundedRect(imgX, imgY, imgSize, imgSize, 3).fillAndStroke('#f1f5f9', '#cbd5e1');
            }
          } else {
            doc.roundedRect(imgX, imgY, imgSize, imgSize, 3).fillAndStroke('#f1f5f9', '#e2e8f0');
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5).text('No Img', imgX, imgY + 18, { width: imgSize, align: 'center' });
          }
        } else if (col.key === 'designNo') {
          doc.fillColor(brand.dark).font('Helvetica-Bold').fontSize(9).text(item.designNo || '—', cx + 5, y + 14, { width: col.w - 10 });
          if (item.processType) {
            doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(item.processType, cx + 5, y + 29, { width: col.w - 10 });
          }
        } else if (col.key === 'desc') {
          doc.fillColor('#0f172a').font('Helvetica').fontSize(8).text(item.description || '—', cx + 5, y + 10, { width: col.w - 10, height: rowH - 14 });
        } else if (col.key === 'size') {
          doc.fillColor('#334155').font('Helvetica').fontSize(7.8).text(item.sizeRatio || '—', cx + 5, y + 12, { width: col.w - 10, height: rowH - 16 });
        } else if (col.key === 'qty') {
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(`${item.qty || 0}`, cx + 4, y + 15, { width: col.w - 8, align: 'right' });
          doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(item.unit || 'Pcs', cx + 4, y + 28, { width: col.w - 8, align: 'right' });
        } else if (col.key === 'rate') {
          doc.fillColor('#0f172a').font('Helvetica').fontSize(8).text(item.rate ? `Rs.${item.rate}` : '—', cx + 4, y + 19, { width: col.w - 8, align: 'right' });
        } else if (col.key === 'remarks') {
          doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(item.remarks || '—', cx + 5, y + 12, { width: col.w - 10, height: rowH - 16 });
        }

        cx += col.w;
      }

      y += rowH;
    }

    // ── Totals Summary Row ──
    doc.rect(margin, y, contentW, 24).fillAndStroke(brand.tint, brand.border);
    const totalSummaryText = showRate && challan.totalValue > 0
      ? `TOTAL:  ${challan.totalDesigns || items.length} Design(s)   |   ${challan.totalQty || 0} ${items[0]?.unit || 'Pcs'}   |   Est. Value: Rs. ${Number(challan.totalValue).toLocaleString('en-IN')}`
      : `TOTAL:  ${challan.totalDesigns || items.length} Design(s)   |   ${challan.totalQty || 0} ${items[0]?.unit || 'Pcs'}`;
    doc
      .fillColor(brand.dark)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(totalSummaryText, margin + 10, y + 7, { width: contentW - 20, align: 'right' });

    y += 34;

    // ── Notes & Terms Box ──
    if (y + 110 > doc.page.height - 36) {
      doc.addPage();
      doc.rect(0, 0, pageW, 6).fill(brand.primary);
      y = 26;
    }

    const notesText = [challan.notes, challan.terms].filter(Boolean).join('\n');
    doc.roundedRect(margin, y, contentW, 46, 4).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text('Special Instructions & Terms:', margin + 10, y + 7);
    doc.fillColor('#475569').font('Helvetica').fontSize(7.8).text(notesText, margin + 10, y + 19, { width: contentW - 20, height: 24 });

    // ── 3-Column Signature Footer ──
    const sigY = Math.max(y + 82, doc.page.height - 86);
    const colW = contentW / 3;
    const labels = ['Prepared By', 'Receiver / Karigar Sign', `For ${brand.name} (Auth. Signatory)`];

    labels.forEach((label, idx) => {
      const lx = margin + idx * colW + 14;
      const lineW = colW - 28;
      doc.moveTo(lx, sigY).lineTo(lx + lineW, sigY).lineWidth(0.8).strokeColor('#64748b').stroke();
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8).text(label, lx, sigY + 6, { width: lineW, align: 'center' });
    });

    doc.end();
  } catch (error) {
    logger.error('downloadJobChallanPdf error: %o', error);
    if (!res.headersSent) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }
};

module.exports = {
  getNextChallanNumber,
  lookupDesign,
  listJobChallans,
  createJobChallan,
  updateJobChallan,
  updateJobChallanStatus,
  deleteJobChallan,
  downloadJobChallanPdf,
};
