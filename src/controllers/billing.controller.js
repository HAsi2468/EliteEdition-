const BillingInvoice = require('../db/models/billingInvoice.model');
const BillingCustomer = require('../db/models/billingCustomer.model');
const BillingItem = require('../db/models/billingItem.model');
const FabricChallan = require('../db/models/fabricChallan.model');
const StitchingChallan = require('../db/models/stitchingChallan.model');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Helper to convert number to Indian Currency Words
function numToWords(amount) {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + words[n % 10] : '');
    if (n < 1000) return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const num = Math.floor(amount || 0);
  if (num === 0) return 'Rupees Zero Only';
  return 'Rupees ' + convert(num) + ' Only';
}

// ── 1. DASHBOARD STATS ────────────────────────────────────────────────────────
const getBillingDashboardStats = async (req, res) => {
  try {
    const totalInvoices = await BillingInvoice.countDocuments();
    const invoices = await BillingInvoice.find().lean();

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    const now = new Date();

    invoices.forEach(inv => {
      totalInvoiced += inv.grandTotal || 0;
      totalPaid += inv.paidAmount || 0;
      totalBalanceDue += inv.balanceDue || 0;

      if (inv.paymentStatus === 'PAID') {
        paidCount++;
      } else {
        unpaidCount++;
        if (inv.dueDate && new Date(inv.dueDate) < now) {
          overdueCount++;
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalInvoices,
        totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalBalanceDue: parseFloat(totalBalanceDue.toFixed(2)),
        paidCount,
        unpaidCount,
        overdueCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 2. GET INVOICES LIST ───────────────────────────────────────────────────────
const getInvoices = async (req, res) => {
  try {
    const { search, paymentStatus, page = 1, limit = 5000, dateStart, dateEnd } = req.query;

    const filter = {};
    if (paymentStatus && paymentStatus !== 'ALL') {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.businessName': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

      const dateQuery = {};
      if (minMs) dateQuery.$gte = new Date(minMs);
      if (maxMs) dateQuery.$lte = new Date(maxMs);

      filter.$or = [
        { invoiceDate: dateQuery },
        { invoiceDate: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const invoices = await BillingInvoice.find(filter)
      .sort({ invoiceSeq: -1, created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await BillingInvoice.countDocuments(filter);

    res.json({
      success: true,
      data: invoices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 3. GET SINGLE INVOICE BY ID ─────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 4. GET NEXT INVOICE NUMBER ──────────────────────────────────────────────
const getNextInvoiceNo = async (req, res) => {
  try {
    const PrintConfig = require('../db/models/printConfig.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};
    const START_SEQ = Number(config.startingInvoiceNo) || 1001;
    const prefix = config.invoicePrefix || 'EDP-INV-';

    const lastInvoice = await BillingInvoice.findOne({}, 'invoiceSeq').sort({ invoiceSeq: -1 });
    const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? Math.max(lastInvoice.invoiceSeq + 1, START_SEQ) : START_SEQ;
    const invoiceNo = `${prefix}${nextSeq}`;

    res.json({ success: true, nextSeq, prefix, invoiceNo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 5. CREATE INVOICE ────────────────────────────────────────────────────────
const createInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;

    if (!invoiceData.invoiceSeq || !invoiceData.invoiceNo) {
      const lastInvoice = await BillingInvoice.findOne({}, 'invoiceSeq').sort({ invoiceSeq: -1 });
      const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? lastInvoice.invoiceSeq + 1 : 1001;
      invoiceData.invoiceSeq = nextSeq;
      invoiceData.invoiceNo = `EDP-INV-${nextSeq}`;
    }

    // Ensure customer object is present
    if (!invoiceData.customer || !invoiceData.customer.name) {
      invoiceData.customer = {
        name: invoiceData.partyName || invoiceData.customerName || 'Walk-in Client',
        businessName: invoiceData.partyName || '',
        state: 'Gujarat',
        stateCode: '24'
      };
    }

    if (!invoiceData.createdBy) {
      invoiceData.createdBy = req.user?.name || req.user?.username || 'Admin';
    }

    // Auto-calculate balance due
    const grandTotal = parseFloat(invoiceData.grandTotal) || 0;
    const paidAmount = parseFloat(invoiceData.paidAmount) || 0;
    const balanceDue = Math.max(0, parseFloat((grandTotal - paidAmount).toFixed(2)));

    invoiceData.balanceDue = balanceDue;

    if (balanceDue === 0 && grandTotal > 0) {
      invoiceData.paymentStatus = 'PAID';
    } else if (paidAmount > 0 && balanceDue > 0) {
      invoiceData.paymentStatus = 'PARTIALLY_PAID';
    } else {
      invoiceData.paymentStatus = 'UNPAID';
    }

    const invoice = await BillingInvoice.create(invoiceData);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = req.user?.name || invoiceData.createdBy || 'Staff User';
      const uId = req.user?._id || invoiceData.userId;
      const cName = invoice.customer ? (invoice.customer.businessName || invoice.customer.name) : 'Client';
      const itemCnt = invoice.items ? invoice.items.length : 0;
      publishActivity({
        actorId: uId,
        actorName: uName,
        action: 'CREATE',
        module: 'Billing Invoice',
        recordRef: invoice.invoiceNo,
        recordId: invoice._id,
        permissionScope: 'billing',
        department: 'Billing',
        description: `🧾 **Tax Invoice #${invoice.invoiceNo}** generated for Client: **"${cName}"** | Total: **₹${invoice.grandTotal || 0}** | Items: **${itemCnt}** by **${uName}**.`
      }).catch(e => console.warn('publishActivity invoice create failed: %s', e.message));
    } catch (e) {
      console.warn('Failed to publish activity for invoice:', e.message);
    }

    // Lock linked Challans to INVOICED if status is FINAL (or default save)
    if (invoice.linkedChallanIds && invoice.linkedChallanIds.length > 0) {
      await FabricChallan.updateMany(
        { _id: { $in: invoice.linkedChallanIds } },
        { $set: { status: 'INVOICED', invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
      );
      await StitchingChallan.updateMany(
        { _id: { $in: invoice.linkedChallanIds } },
        { $set: { status: 'INVOICED', invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
      );
    }

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 6. UPDATE INVOICE ────────────────────────────────────────────────────────
const updateInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;
    const grandTotal = parseFloat(invoiceData.grandTotal) || 0;
    const paidAmount = parseFloat(invoiceData.paidAmount) || 0;
    const balanceDue = Math.max(0, parseFloat((grandTotal - paidAmount).toFixed(2)));

    invoiceData.balanceDue = balanceDue;

    if (balanceDue === 0 && grandTotal > 0) {
      invoiceData.paymentStatus = 'PAID';
    } else if (paidAmount > 0 && balanceDue > 0) {
      invoiceData.paymentStatus = 'PARTIALLY_PAID';
    } else {
      invoiceData.paymentStatus = 'UNPAID';
    }

    const invoice = await BillingInvoice.findByIdAndUpdate(req.params.id, invoiceData, { new: true });
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Lock linked Challans to INVOICED
    if (invoice.linkedChallanIds && invoice.linkedChallanIds.length > 0) {
      await FabricChallan.updateMany(
        { _id: { $in: invoice.linkedChallanIds } },
        { $set: { status: 'INVOICED', invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
      );
      await StitchingChallan.updateMany(
        { _id: { $in: invoice.linkedChallanIds } },
        { $set: { status: 'INVOICED', invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
      );
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 6B. MERGE CHALLANS TO INVOICE ───────────────────────────────────────────
const mergeChallans = async (req, res) => {
  try {
    const { challanIds } = req.body;
    if (!Array.isArray(challanIds) || challanIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one Challan to merge.' });
    }

    // 1. Fetch Fabric Challans & Stitching Challans
    const fabricChallans = await FabricChallan.find({ _id: { $in: challanIds } }).lean();
    const stitchingChallans = await StitchingChallan.find({ _id: { $in: challanIds } }).lean();

    const allChallans = [...fabricChallans, ...stitchingChallans];
    if (allChallans.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching Challans found.' });
    }

    // 2. FLEXIBLE SAME-CUSTOMER VALIDATION CHECK
    const normalizeKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const customerKeys = new Set(
      allChallans.map(ch => normalizeKey(ch.billTo || ch.partyName)).filter(Boolean)
    );
    const partyNameKeys = new Set(
      allChallans.map(ch => normalizeKey(ch.partyName || ch.billTo)).filter(Boolean)
    );

    if (customerKeys.size > 1 && partyNameKeys.size > 1) {
      const partyList = [...new Set(allChallans.map(ch => ch.billTo || ch.partyName).filter(Boolean))].join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot merge Challans from different customers. Selected Challans belong to multiple customers: ${partyList}`
      });
    }

    // 3. AGGREGATE CUSTOMER DETAILS
    const rawParty = allChallans[0].billTo || allChallans[0].partyName || '';
    let customerObj = {
      name: rawParty,
      businessName: rawParty,
      phone: '',
      email: '',
      gstin: '',
      billingAddress: '',
      shippingAddress: '',
      state: 'Gujarat',
      stateCode: '24'
    };

    if (rawParty) {
      const matchedCust = await BillingCustomer.findOne({
        $or: [
          { name: { $regex: `^${rawParty.trim()}$`, $options: 'i' } },
          { businessName: { $regex: `^${rawParty.trim()}$`, $options: 'i' } }
        ]
      }).lean();
      if (matchedCust) {
        customerObj = {
          customerId: matchedCust._id,
          name: matchedCust.name || rawParty,
          businessName: matchedCust.businessName || matchedCust.name || rawParty,
          phone: matchedCust.phone || '',
          email: matchedCust.email || '',
          gstin: matchedCust.gstin || '',
          billingAddress: matchedCust.billingAddress || '',
          shippingAddress: matchedCust.shippingAddress || matchedCust.billingAddress || '',
          state: matchedCust.state || 'Gujarat',
          stateCode: matchedCust.stateCode || '24'
        };
      }
    }

    // 4. AGGREGATE LINE ITEMS (GROUPED BY CHALLAN NO)
    const items = [];
    const linkedChallanIds = [];
    const linkedChallanNos = [];
    const catalogItems = await BillingItem.find().lean();

    allChallans.forEach(ch => {
      const chNoStr = ch.challanNo
        ? (String(ch.challanNo).startsWith('PCH') || String(ch.challanNo).startsWith('EDP')
            ? String(ch.challanNo)
            : `EDP-${ch.challanNo}`)
        : `EDP-${ch._id}`;

      linkedChallanIds.push(String(ch._id));
      linkedChallanNos.push(chNoStr);

      if (Array.isArray(ch.items) && ch.items.length > 0) {
        // Stitching Challan or Multi-item Challan
        ch.items.forEach(it => {
          const pcs = parseFloat(it.pcs) || 1;
          const rate = parseFloat(it.rate) || 0;
          const itemName = it.designNo ? `Design ${it.designNo}` : (it.particulars || 'Garment Work');
          const matched = catalogItems.find(cat => cat.itemName.trim().toLowerCase() === itemName.trim().toLowerCase());
          const unitPrice = matched?.unitPrice != null ? matched.unitPrice : rate;
          const taxRate = matched?.taxRate != null ? matched.taxRate : 5;

          items.push({
            itemName,
            description: `Challan ${chNoStr} | ${it.particulars || 'Stitching Work'}`,
            jobNo: ch.jobNo || it.jobNo || '',
            lotNo: ch.lotNo || it.lotNo || '',
            partyChallan: ch.vendorChallanNo ? String(ch.vendorChallanNo) : (ch.partyChallan ? String(ch.partyChallan) : ''),
            ourChallanNo: chNoStr,
            challanId: String(ch._id),
            isLocked: true, // MTR / PCS LOCKED
            imageUrl: it.imageUrl || ch.imageUrl || '',
            hsnCode: it.hsnCode || matched?.hsnCode || '6204',
            qty: pcs,
            unit: matched?.unit || 'Pcs',
            unitPrice,
            taxRate,
            totalAmount: parseFloat((pcs * unitPrice).toFixed(2))
          });
        });
      } else {
        // Digital Print Fabric Delivery Challan
        const mtr = parseFloat(ch.totalMtr || ch.pcs || 1);
        const pannaStr = String(ch.panna || '').trim();
        let itemName = 'DIGITAL PRINT JOB WORK 58"';
        if (pannaStr.includes('36')) itemName = 'DIGITAL PRINT JOB WORK 36"';
        else if (pannaStr.includes('44')) itemName = 'DIGITAL PRINT JOB WORK 44"';
        else if (pannaStr.includes('58')) itemName = 'DIGITAL PRINT JOB WORK 58"';
        else if (pannaStr) itemName = `DIGITAL PRINT JOB WORK ${pannaStr.replace(/['"]/g, '')}"`;

        const matched = catalogItems.find(cat => cat.itemName.trim().toLowerCase() === itemName.trim().toLowerCase());
        const hsnCode = matched?.hsnCode || '998821';
        const unitPrice = matched?.unitPrice != null ? matched.unitPrice : 25;
        const taxRate = matched?.taxRate != null ? matched.taxRate : 5;
        const unit = matched?.unit || 'Meters';

        items.push({
          itemName,
          description: `Challan ${chNoStr} | Fabric: ${ch.fabricName || 'Fabric'}`,
          jobNo: ch.jobNo || '',
          lotNo: ch.lotNo || '',
          partyChallan: ch.vendorChallanNo ? String(ch.vendorChallanNo) : (ch.partyChallan ? String(ch.partyChallan) : ''),
          ourChallanNo: chNoStr,
          challanId: String(ch._id),
          isLocked: true, // MTR LOCKED
          imageUrl: ch.designImage || ch.imageUrl || '',
          hsnCode,
          qty: mtr,
          unit,
          unitPrice,
          taxRate,
          totalAmount: parseFloat((mtr * unitPrice).toFixed(2))
        });
      }
    });

    const deliveryByList = [...new Set(allChallans.map(ch => ch.deliveryBy).filter(Boolean))].join(', ');

    res.json({
      success: true,
      data: {
        customer: customerObj,
        items,
        linkedChallanIds,
        linkedChallanNos,
        deliveryBy: deliveryByList
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 7. DELETE INVOICE ────────────────────────────────────────────────────────
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 8. RECORD PAYMENT FOR INVOICE ───────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { amount, method, referenceNo, notes } = req.body;
    const paymentAmt = parseFloat(amount) || 0;

    if (paymentAmt <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than 0' });
    }

    const invoice = await BillingInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    invoice.paidAmount = parseFloat(((invoice.paidAmount || 0) + paymentAmt).toFixed(2));
    invoice.balanceDue = Math.max(0, parseFloat((invoice.grandTotal - invoice.paidAmount).toFixed(2)));

    if (invoice.balanceDue === 0) {
      invoice.paymentStatus = 'PAID';
    } else {
      invoice.paymentStatus = 'PARTIALLY_PAID';
    }

    invoice.paymentHistory.push({
      date: new Date(),
      amount: paymentAmt,
      method: method || 'Bank Transfer',
      referenceNo: referenceNo || '',
      notes: notes || ''
    });

    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 9. DOWNLOAD INVOICE PDF ──────────────────────────────────────────────────
const downloadInvoicePdf = async (req, res) => {
  const startTime = Date.now();
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).send('Invoice not found');

    const includeDuplicate = req.query.duplicate === 'true';

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const rawCompName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyDisplayName = rawCompName.replace(/\s*\([^)]*\)/g, '').trim();
    const companyGstin   = config.companyGstin   || '24AANFE0044M1ZG';
    const companyAddress = config.companyAddress  || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone   = config.companyPhone   || '+91 98790 00000';
    const companyState   = config.companyState   || 'Gujarat';
    const companyStateCode = config.companyStateCode || '24';
    const companyTerms   = invoice.terms || config.companyTerms ||
      'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
    const bankName   = config.companyBankName  || 'ICICI Bank';
    const bankAcNo   = config.companyAccountNo || 'N/A';
    const bankIfsc   = config.companyIfscCode  || 'N/A';

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const PW = 595.28, PH = 841.89;
    const PAD = 18;
    const CW = PW - PAD * 2;
    const logoPath = path.join(__dirname, 'Logo.png');

    // ── HELPERS ─────────────────────────────────────────────────────────────────
    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').trim();
      try { filename = decodeURIComponent(filename); } catch(e) {}
      const dirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../../../elite_edition_images'),
        '/home/ubuntu/elite_edition_images',
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        '/home/ubuntu/Digital print'
      ];
      for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        const direct = path.join(d, filename);
        if (fs.existsSync(direct)) return direct;
        try {
          const f = fs.readdirSync(d).find(x => x.toLowerCase() === filename.toLowerCase());
          if (f) return path.join(d, f);
        } catch(e) {}
      }
      return null;
    };

    const cleanJobDisplay = (jobStr) => {
      if (!jobStr) return '';
      const matches = String(jobStr).match(/\d+/g);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        return unique.length === 1 ? `Job Card: ${unique[0]}` : `Job Cards: ${unique.join(', ')}`;
      }
      return String(jobStr).replace(/JOB NO\.-?\s*/gi,'').replace(/Job\s*#?\s*/gi,'').trim();
    };

    // ── COLUMN WIDTHS ────────────────────────────────────────────────────────────
    const COL = [18, 100, 132, 54, 34, 60, 60, 30, 71.28];
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    // ── OPTIMIZED HIGH-SPEED PRE-LOAD IMAGES ──────────────────────────────────
    const items = invoice.items || [];

    const allJobNumsSet = new Set();
    items.forEach(it => {
      if (it.jobNo) {
        const matches = String(it.jobNo).match(/\d+/g) || [];
        matches.forEach(n => allJobNumsSet.add(n));
      }
    });
    const jobNumArray = Array.from(allJobNumsSet);

    const jobCardMap = {};
    if (jobNumArray.length > 0) {
      try {
        const queryOr = [];
        jobNumArray.forEach(n => {
          queryOr.push({ jobNo: n }, { jobNo: `JOB NO.- ${n}` }, { jobNo: `JOB NO.-${n}` });
        });
        const foundJobCards = await JobCard.find({ $or: queryOr }).select('jobNo imageUrl1 imageUrl2 proofing.artworkUrl').lean();
        foundJobCards.forEach(jc => {
          const nums = String(jc.jobNo).match(/\d+/g) || [];
          nums.forEach(n => { if (!jobCardMap[n]) jobCardMap[n] = jc; });
        });
      } catch(e) {}
    }

    const itemImages = items.map(item => {
      let imgPath = resolveImagePath(item.imageUrl);
      if (!imgPath && item.jobNo) {
        const nums = String(item.jobNo).match(/\d+/g) || [];
        for (const num of nums) {
          const jd = jobCardMap[num];
          if (jd) {
            const url = jd.imageUrl1 || jd.imageUrl2 || jd.proofing?.artworkUrl;
            if (url) {
              imgPath = resolveImagePath(url);
              if (imgPath) break;
            }
          }
        }
      }
      return imgPath;
    });

    const taxType = invoice.taxType || (invoice.customer && invoice.customer.stateCode && String(invoice.customer.stateCode).trim() !== '24' ? 'IGST' : 'CGST_SGST');
    const isIgst = taxType === 'IGST';

    const hsnMap = {};
    items.forEach(it => {
      const hsn  = it.hsnCode || '998821';
      const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : 5);
      const key  = `${hsn}_${rate}`;
      if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      const taxable = Number(it.totalAmount || 0);
      hsnMap[key].taxable += taxable;
      if (isIgst) {
        hsnMap[key].igst += taxable * (rate / 100);
      } else {
        hsnMap[key].cgst += taxable * (rate / 2 / 100);
        hsnMap[key].sgst += taxable * (rate / 2 / 100);
      }
    });
    const hsnRows      = Object.values(hsnMap);
    const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
    const totalCgst    = hsnRows.reduce((s, r) => s + r.cgst,    0);
    const totalSgst    = hsnRows.reduce((s, r) => s + r.sgst,    0);
    const totalIgst    = hsnRows.reduce((s, r) => s + r.igst,    0);
    const totalTax     = isIgst ? totalIgst : (totalCgst + totalSgst);

    let delByVal = invoice.deliveryBy || '';
    if (!delByVal && Array.isArray(invoice.linkedChallanIds) && invoice.linkedChallanIds.length > 0) {
      try {
        const FabricChallan = require('../db/models/fabricChallan.model');
        const StitchingChallan = require('../db/models/stitchingChallan.model');
        const fChs = await FabricChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
        const sChs = await StitchingChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
        const allDel = [...fChs, ...sChs].map(c => c.deliveryBy).filter(Boolean);
        if (allDel.length > 0) delByVal = [...new Set(allDel)].join(', ');
      } catch(e) {}
    }
    if (!delByVal) delByVal = 'By Road';

    const renderPage = (copyLabel, bw = false) => {
      const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;
      const PRP  = c('#4c1d95', '#000000');
      const PRPM = c('#6b21a8', '#000000');
      const PRPL = c('#ede9fe', '#f0f0f0');
      const S900 = c('#000000', '#000000');
      const S700 = c('#000000', '#000000');
      const S500 = c('#000000', '#000000');
      const S200 = c('#e2e8f0', '#cccccc');
      const S50  = c('#f8fafc', '#f9f9f9');
      const WHT  = '#ffffff';

      const useTwoPages = items.length > 5;

      const drawHeader = (pageLabel) => {
        let Y = PAD;

        doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);
        doc.rect(PAD, Y, CW, 4).fill(PRP);
        Y += 4;

        const hdrH = 62;
        doc.rect(PAD, Y, CW, hdrH).fill(S50);

        if (fs.existsSync(logoPath)) {
          try { doc.image(logoPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
        }

        doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
          .text(`${companyDisplayName.toUpperCase()} (${companyGstin})`, PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text(companyAddress.toUpperCase(), PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
          .text(`PHONE: ${companyPhone}   STATE: ${companyState}, CODE: ${companyStateCode}`,
                PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

        Y += hdrH;

        const titleH = 22;
        doc.rect(PAD, Y, CW, titleH).fill(PRPL);
        doc.fillColor(PRP).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', PAD, Y + 4, { width: CW, align: 'center' });
        doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
          .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
        Y += titleH;

        const cust   = invoice.customer || {};
        const halfCW = Math.floor(CW / 2);

        const rawChallanStr = invoice.ourChallanNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '--';

        // Calculate dynamic height for BILL TO box
        const custNameStr   = cust.businessName || cust.name || '--';
        const custGstStr    = cust.gstin && cust.gstin !== 'N/A' ? ` (GST: ${cust.gstin})` : '';
        const fullCustTitle = `${custNameStr}${custGstStr}`;

        let custY = Y + 16;
        doc.font('Helvetica-Bold').fontSize(9.5);
        custY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

        if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
          doc.font('Helvetica').fontSize(8);
          custY += doc.heightOfString(cust.billingAddress.trim(), { width: halfCW - 10 }) + 3;
        }
        custY += 14; // For State and Code line

        // Calculate dynamic height for SELLER / DISPATCH box
        const rx = PAD + halfCW;
        const metaW = (CW - halfCW) / 2 - 5;
        const pairs = [
          ['Challan No.', rawChallanStr, 'Tax Invoice No.', invoice.invoiceNo || '--'],
          ['', '', 'Terms of Delivery', delByVal],
        ];
        if (useTwoPages && pageLabel) {
          pairs.push(['Page', pageLabel, '', '']);
        }

        let testMetaY = Y + 16;
        pairs.forEach(([k1, v1, k2, v2]) => {
          doc.font('Helvetica-Bold').fontSize(8);
          const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
          const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
          const leftH = (k1 ? 8 : 0) + vh1;
          const rightH = (k2 ? 8 : 0) + vh2;
          const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;
          testMetaY += rowH;
        });

        const infoH = Math.max(76, custY - Y, testMetaY - Y + 4);

        // Render Boxes
        doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
        doc.rect(PAD, Y, halfCW, 14).fill(PRP);
        doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
          .text('BILL TO', PAD + 5, Y + 3, { width: halfCW - 10 });

        let drawCustY = Y + 16;
        doc.fillColor(S900).fontSize(9.5).font('Helvetica-Bold')
          .text(fullCustTitle, PAD + 5, drawCustY, { width: halfCW - 10 });
        drawCustY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

        if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
          const addrStr = cust.billingAddress.trim();
          doc.fillColor(S700).fontSize(8).font('Helvetica')
            .text(addrStr, PAD + 5, drawCustY, { width: halfCW - 10 });
          doc.font('Helvetica').fontSize(8);
          drawCustY += doc.heightOfString(addrStr, { width: halfCW - 10 }) + 3;
        }

        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, drawCustY);

        doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
        doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
        doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
          .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });

        let metaY = Y + 16;
        pairs.forEach(([k1, v1, k2, v2]) => {
          doc.font('Helvetica-Bold').fontSize(8);
          const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
          const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
          const leftH = (k1 ? 8 : 0) + vh1;
          const rightH = (k2 ? 8 : 0) + vh2;
          const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;

          if (k1 || v1) {
            if (k1) {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text(k1 + ':', rx + 4, metaY, { width: metaW });
            }
            if (v1) {
              const valY = k1 ? metaY + 8 : metaY;
              doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                .text(v1, rx + 4, valY, { width: metaW });
            }
          }
          if (k2 || v2) {
            if (k2) {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
            }
            if (v2) {
              const valY = k2 ? metaY + 8 : metaY;
              doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                .text(v2, rx + metaW + 10, valY, { width: metaW });
            }
          }
          metaY += rowH;
        });

        Y += infoH;
        return Y;
      };

      const drawItemsTable = (startY, itemsToRender, startIdx, isLastPage, minBottomY) => {
        let Y = startY;

        const tblHdrH = 22;
        doc.rect(PAD, Y, CW, tblHdrH).fill(PRP);
        doc.fillColor(WHT).fontSize(9.5).font('Helvetica-Bold');
        const hdrs   = ['Sr.', 'Image', 'Description of Goods', 'HSN', 'GST%', 'Qty', 'Rate', 'Per', 'Amount'];
        const aligns = ['left','center','left','center','center','center','right','center','right'];
        hdrs.forEach((h, i) => doc.text(h, colX[i] + 2, Y + 7, { width: COL[i] - 4, align: aligns[i] }));
        Y += tblHdrH;

        const drawColSeps = (rowY, rowH) => {
          colX.slice(1).forEach(cx => {
            doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(S200).lineWidth(0.4).stroke();
          });
        };

        let targetRowHPerItem = 34;
        if (!isLastPage && itemsToRender.length > 0) {
          const pageBottomLimit = PH - PAD - 22;
          const availableSpace = pageBottomLimit - startY - tblHdrH;
          if (availableSpace > 0) {
            targetRowHPerItem = Math.floor(availableSpace / itemsToRender.length);
          }
        }

        itemsToRender.forEach((item, localIdx) => {
          const idx = startIdx + localIdx;
          const rowBg = localIdx % 2 === 0 ? WHT : S50;

          const metaLines = [];
          const jd = cleanJobDisplay(item.jobNo);
          if (jd) metaLines.push({ text: jd, font: 'Helvetica-Bold', size: 8.5, color: PRPM });
          const p1 = [];
          if (item.lotNo)        p1.push(`Lot: ${item.lotNo}`);
          if (item.partyChallan) p1.push(`Vendor Challan: ${item.partyChallan}`);
          if (p1.length) metaLines.push({ text: p1.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
          const p2 = [];
          if (item.description)  p2.push(item.description);
          if (p2.length) metaLines.push({ text: p2.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
          if (item.fabric) metaLines.push({ text: `Fabric: ${item.fabric}`, font: 'Helvetica', size: 8, color: S500 });

          doc.font('Helvetica-Bold').fontSize(11);
          let descH = doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 });
          metaLines.forEach(m => {
            doc.font(m.font).fontSize(m.size);
            descH += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
          });
          const rowH = Math.max(targetRowHPerItem, descH + 10);

          doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
          drawColSeps(Y, rowH);

          const contentPadY = Math.max(6, Math.floor((rowH - Math.max(34, descH)) / 2));

          doc.fillColor(S700).fontSize(10).font('Helvetica-Bold')
            .text(String(idx + 1), colX[0] + 3, Y + contentPadY, { width: COL[0] - 3 });

          const imgPath = itemImages[idx];
          const imgMaxW = COL[1] - 6;
          const imgMaxH = Math.min(rowH - 10, 100);
          if (imgPath && fs.existsSync(imgPath)) {
            try {
              const imgY = Y + Math.max(4, Math.floor((rowH - imgMaxH) / 2));
              doc.image(imgPath, colX[1] + 3, imgY, { fit: [imgMaxW, imgMaxH] });
            } catch(e) {
              doc.fillColor(S200).fontSize(7).font('Helvetica')
                .text('N/A', colX[1], Y + contentPadY + 6, { width: COL[1], align: 'center' });
            }
          } else {
            doc.fillColor(S200).fontSize(7).font('Helvetica')
              .text('N/A', colX[1], Y + contentPadY + 6, { width: COL[1], align: 'center' });
          }

          let textY = Y + contentPadY;
          doc.fillColor(S900).font('Helvetica').fontSize(11);
          doc.text(item.itemName || '--', colX[2] + 3, textY, { width: COL[2] - 6 });
          textY += doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 }) + 2;
          metaLines.forEach(m => {
            doc.font(m.font).fontSize(m.size).fillColor(m.color);
            doc.text(m.text, colX[2] + 3, textY, { width: COL[2] - 6 });
            textY += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
          });

          const numY    = Y + contentPadY;
          const taxRate = item.taxRate || 5;
          let u = (item.unit || 'MTR').trim();
          if (/meter|mtr/i.test(u)) u = 'MTR';
          doc.fillColor(S700).font('Helvetica').fontSize(9.5)
            .text(item.hsnCode || '998821', colX[3] + 2, numY, { width: COL[3] - 4, align: 'center' })
            .text(`${taxRate}%`,            colX[4] + 2, numY, { width: COL[4] - 4, align: 'center' });
          doc.fillColor(S900).font('Helvetica').fontSize(10)
            .text(`${Number(item.qty||0).toFixed(2)} ${u}`, colX[5]+2, numY, { width: COL[5]-4, align:'center' })
            .text(Number(item.unitPrice||0).toFixed(2), colX[6]+2, numY, { width: COL[6]-4, align:'right' });
          doc.fillColor(S500).font('Helvetica').fontSize(8.5)
            .text(u, colX[7]+2, numY, { width: COL[7]-4, align:'center' });
          doc.fillColor(S900).font('Helvetica').fontSize(10.5)
            .text(Number(item.totalAmount||0).toFixed(2), colX[8]+2, numY, { width: COL[8]-4, align:'right' });
          Y += rowH;
        });

        // Fill remaining table height so table reaches minBottomY
        if (minBottomY && Y < minBottomY) {
          const fillH = minBottomY - Y;
          doc.rect(PAD, Y, CW, fillH).fill(WHT).stroke(S200);
          drawColSeps(Y, fillH);
          Y = minBottomY;
        }

        return Y;
      };

      const drawSummary = (startY) => {
        let Y = startY;

        if (isIgst) {
          hsnRows.forEach(row => {
            const trH = 16;
            doc.rect(PAD, Y, CW, trH).fill(PRPL).stroke(S200);
            doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
              .text(`IGST @ ${row.rate}%`, colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
            doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
              .text(row.igst.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
            Y += trH;
          });
        } else {
          hsnRows.forEach(row => {
            const halfRate = row.rate / 2;
            ['CGST', 'SGST'].forEach(type => {
              const amt = type === 'CGST' ? row.cgst : row.sgst;
              const trH = 16;
              doc.rect(PAD, Y, CW, trH).fill(PRPL).stroke(S200);
              doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
                .text(`${type} @ ${halfRate}%`, colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
              doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
                .text(amt.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
              Y += trH;
            });
          });
        }

        let computedRoundOff = 0;
        if (invoice.roundOff !== undefined && invoice.roundOff !== null && Number(invoice.roundOff) !== 0) {
          computedRoundOff = Number(invoice.roundOff);
        } else if (invoice.grandTotal) {
          const rawSum = totalTaxable + totalTax;
          computedRoundOff = Number((Number(invoice.grandTotal) - rawSum).toFixed(2));
        }

        const roH = 16;
        doc.rect(PAD, Y, CW, roH).fill(PRPL).stroke(S200);
        doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
          .text('Round Off', colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
        const roStr = computedRoundOff > 0 ? `+${computedRoundOff.toFixed(2)}` : computedRoundOff.toFixed(2);
        doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
          .text(roStr, colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
        Y += roH;

        const totH = 22;
        doc.rect(PAD, Y, CW, totH).fill(PRP);
        doc.fillColor(WHT).fontSize(10).font('Helvetica-Bold')
          .text('Total', colX[6] - 20, Y + 6, { width: COL[6] + COL[7] + 16, align: 'right' })
          .text(`Rs. ${Number(invoice.grandTotal||0).toFixed(2)}`, colX[8] + 2, Y + 6, { width: COL[8]-4, align: 'right' });
        Y += totH;

        const wordsH = 28;
        doc.rect(PAD, Y, CW, wordsH).fill(S50).stroke(S200);
        doc.fillColor(S700).fontSize(7.5).font('Helvetica-Bold')
          .text('Amount Chargeable (in words):', PAD + 5, Y + 4);
        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(numToWords(invoice.grandTotal), PAD + 5, Y + 14, { width: CW - 80 });
        doc.fillColor(S500).fontSize(7).font('Helvetica')
          .text('E. & O.E.', PAD + CW - 55, Y + 14, { width: 50, align: 'right' });
        Y += wordsH;

        if (isIgst) {
          const TC = [90, 120, 90, 130];
          TC.push(CW - TC.reduce((a,b) => a+b, 0));
          const TX = TC.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?TC[i-1]:0)); return acc; }, []);

          const tHdrH2 = 18;
          doc.rect(PAD, Y, CW, tHdrH2).fill(PRP);
          doc.fillColor(WHT).fontSize(7.5).font('Helvetica-Bold');
          ['HSN','Taxable Value','IGST %','IGST Amount','Total Tax'].forEach((h, i) => {
            const align = i === 0 ? 'left' : (i === 2 ? 'center' : 'right');
            doc.text(h, TX[i] + 2, Y + 5, { width: TC[i] - 4, align });
          });
          Y += tHdrH2;

          hsnRows.forEach((row, i) => {
            const rH = 16;
            doc.rect(PAD, Y, CW, rH).fill(i % 2 === 0 ? WHT : S50).stroke(S200);
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(row.hsn, TX[0]+2, Y+4, { width: TC[0]-4 })
              .text(row.taxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
              .text(`${row.rate}%`, TX[2]+2, Y+4, { width: TC[2]-4, align:'center' })
              .text(row.igst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' });
            doc.fillColor(S900).font('Helvetica-Bold')
              .text(row.igst.toFixed(2), TX[4]+2, Y+4, { width: TC[4]-4, align:'right' });
            Y += rH;
          });

          const tTotH = 17;
          doc.rect(PAD, Y, CW, tTotH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total', TX[0]+2, Y+4, { width: TC[0]-4 })
            .text(totalTaxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
            .text(totalIgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
            .text(totalIgst.toFixed(2), TX[4]+2, Y+4, { width: TC[4]-4, align:'right' });
          Y += tTotH + 3;
        } else {
          const TC = [58, 86, 44, 74, 44, 74];
          TC.push(CW - TC.reduce((a,b) => a+b, 0));
          const TX = TC.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?TC[i-1]:0)); return acc; }, []);

          const tHdrH2 = 18;
          doc.rect(PAD, Y, CW, tHdrH2).fill(PRP);
          doc.fillColor(WHT).fontSize(7.5).font('Helvetica-Bold');
          ['HSN','Taxable Value','CGST %','CGST Amount','SGST %','SGST Amount','Total Tax'].forEach((h, i) => {
            const align = i === 0 ? 'left' : (i === 2 || i === 4 ? 'center' : 'right');
            doc.text(h, TX[i] + 2, Y + 5, { width: TC[i] - 4, align });
          });
          Y += tHdrH2;

          hsnRows.forEach((row, i) => {
            const rH = 16;
            doc.rect(PAD, Y, CW, rH).fill(i % 2 === 0 ? WHT : S50).stroke(S200);
            const halfRate = row.rate / 2;
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(row.hsn, TX[0]+2, Y+4, { width: TC[0]-4 })
              .text(row.taxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
              .text(`${halfRate}%`, TX[2]+2, Y+4, { width: TC[2]-4, align:'center' })
              .text(row.cgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
              .text(`${halfRate}%`, TX[4]+2, Y+4, { width: TC[4]-4, align:'center' })
              .text(row.sgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' });
            doc.fillColor(S900).font('Helvetica-Bold')
              .text((row.cgst+row.sgst).toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
            Y += rH;
          });

          const tTotH = 17;
          doc.rect(PAD, Y, CW, tTotH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total', TX[0]+2, Y+4, { width: TC[0]-4 })
            .text(totalTaxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
            .text(totalCgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
            .text(totalSgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' })
            .text(totalTax.toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
          Y += tTotH + 3;
        }

        doc.fillColor(S500).fontSize(7.5).font('Helvetica')
          .text('Tax Amount (in words):', PAD+2, Y+2)
          .text(numToWords(totalTax), PAD+105, Y+2, { width: CW-109 });
        Y += 16;
        return Y;
      };

      const drawFooter = (startY) => {
        const minFooterY = PH - PAD - 72;
        const validStartY = (typeof startY === 'number' && !isNaN(startY)) ? startY : minFooterY - 8;
        const footerY = Math.max(validStartY + 8, minFooterY);
        doc.moveTo(PAD, footerY).lineTo(PAD+CW, footerY).strokeColor(S200).lineWidth(0.6).stroke();

        const leftFW = 300;
        const rightFX = PAD + leftFW + 8;
        const rightFW = CW - leftFW - 8;

        doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
          .text("Company's Bank Details:", PAD+4, footerY+5);
        doc.fillColor(S700).fontSize(8).font('Helvetica')
          .text(`Bank Name: ${bankName}`, PAD+4, footerY+16)
          .text(`A/c No.: ${bankAcNo}`, PAD+4, footerY+26)
          .text(`Branch & IFS Code: ${bankIfsc}`, PAD+4, footerY+36);
        doc.fillColor(S500).fontSize(6.5).font('Helvetica')
          .text('Terms & Conditions:', PAD+4, footerY+50)
          .text(companyTerms, PAD+4, footerY+58, { width: leftFW });

        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(`for ${companyDisplayName.toUpperCase()}`, rightFX, footerY+5, { width: rightFW, align:'right' });
        doc.moveTo(rightFX + rightFW - 100, footerY + 48).lineTo(rightFX + rightFW, footerY + 48)
          .strokeColor(S500).lineWidth(0.5).stroke();
        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text('Authorised Signatory', rightFX, footerY+50, { width: rightFW, align:'right' });

        const bottomNoteY = PH - PAD - 14;
        doc.moveTo(PAD, bottomNoteY).lineTo(PAD+CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
        doc.fillColor(S500).fontSize(7).font('Helvetica')
          .text('This is a Computer Generated Document', PAD, bottomNoteY+3, { width: CW, align:'center' });
      };

      // Calculate exact summary height to position minBottomY
      const sumH = isIgst
        ? (16 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)
        : (32 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16);
      const minBottomY = PH - PAD - 76 - sumH;

      if (useTwoPages) {
        // Page 1: Items 0..4 (first 5 items)
        let Y = drawHeader('1 of 2');
        Y = drawItemsTable(Y, items.slice(0, 5), 0, false);
        doc.rect(PAD, PH - PAD - 20, CW, 20).fill(PRPL);
        doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
          .text(`Continued on Page 2  ›  GST Summary & Payment Details  (Invoice: ${invoice.invoiceNo})`, PAD, PH - PAD - 13, { width: CW, align: 'center' });

        // Page 2
        doc.addPage();
        Y = drawHeader('2 of 2');
        doc.rect(PAD, Y, CW, 18).fill(PRPL);
        doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
          .text(`‹  ${invoice.invoiceNo}  —  Tax Summary & Payment Details  (${items.length} Line Items)`, PAD, Y + 5, { width: CW, align: 'center' });
        Y += 18;

        Y = drawItemsTable(Y, items.slice(5), 5, true, minBottomY);
        Y = drawSummary(Y);
        drawFooter(Y);

      } else {
        // 1 page
        let Y = drawHeader('');
        Y = drawItemsTable(Y, items, 0, true, minBottomY);
        Y = drawSummary(Y);
        drawFooter(Y);
      }
    };

    // ── RENDER PAGES ──────────────────────────────────────────────────────────
    // Page 1 (and 2 if > 5 items): Colourful original
    renderPage('ORIGINAL FOR BUYER', false);

    // Page 2/3/4 (if duplicate requested): Black & White duplicate
    if (includeDuplicate) {
      doc.addPage({ margin: 0, size: 'A4' });
      renderPage('DUPLICATE COPY', true);
    }

    console.log(`[PDF Performance] Invoice ${invoice.invoiceNo} PDF generated in ${Date.now() - startTime}ms (${items.length} items)`);
    doc.end();

  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    res.status(500).send('Error generating PDF invoice');
  }
};

// ── 9B. DOWNLOAD BULK INVOICES MERGED PDF ──────────────────────────────────
const downloadBulkInvoicesPdf = async (req, res) => {
  const startTime = Date.now();
  try {
    let ids = [];
    if (req.query.ids) {
      ids = String(req.query.ids).split(',').map(s => s.trim()).filter(Boolean);
    } else if (req.body && Array.isArray(req.body.ids)) {
      ids = req.body.ids;
    }

    if (ids.length === 0) {
      return res.status(400).send('No invoice IDs provided for bulk PDF generation.');
    }

    const invoices = await BillingInvoice.find({ _id: { $in: ids } }).sort({ invoiceSeq: 1, created_at: 1 }).lean();
    if (invoices.length === 0) {
      return res.status(404).send('No matching invoices found.');
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const FabricChallan = require('../db/models/fabricChallan.model');
    const StitchingChallan = require('../db/models/stitchingChallan.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const rawCompName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyDisplayName = rawCompName.replace(/\s*\([^)]*\)/g, '').trim();
    const companyGstin   = config.companyGstin   || '24AANFE0044M1ZG';
    const companyAddress = config.companyAddress  || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone   = config.companyPhone   || '+91 98790 00000';
    const companyState   = config.companyState   || 'Gujarat';
    const companyStateCode = config.companyStateCode || '24';
    const bankName   = config.companyBankName  || 'ICICI Bank';
    const bankAcNo   = config.companyAccountNo || 'N/A';
    const bankIfsc   = config.companyIfscCode  || 'N/A';

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Combined_Tax_Invoices_${invoices.length}_Items.pdf"`);
    doc.pipe(res);

    const PW = 595.28, PH = 841.89;
    const PAD = 18;
    const CW = PW - PAD * 2;
    const logoPath = path.join(__dirname, 'Logo.png');

    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').trim();
      try { filename = decodeURIComponent(filename); } catch(e) {}
      const dirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../../../elite_edition_images'),
        '/home/ubuntu/elite_edition_images',
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        '/home/ubuntu/Digital print'
      ];
      for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        const direct = path.join(d, filename);
        if (fs.existsSync(direct)) return direct;
        try {
          const f = fs.readdirSync(d).find(x => x.toLowerCase() === filename.toLowerCase());
          if (f) return path.join(d, f);
        } catch(e) {}
      }
      return null;
    };

    const cleanJobDisplay = (jobStr) => {
      if (!jobStr) return '';
      const matches = String(jobStr).match(/\d+/g);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        return unique.length === 1 ? `Job Card: ${unique[0]}` : `Job Cards: ${unique.join(', ')}`;
      }
      return String(jobStr).replace(/JOB NO\.-?\s*/gi,'').replace(/Job\s*#?\s*/gi,'').trim();
    };

    const COL = [18, 100, 132, 54, 34, 60, 60, 30, 71.28];
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    for (let invIdx = 0; invIdx < invoices.length; invIdx++) {
      const invoice = invoices[invIdx];
      if (invIdx > 0) {
        doc.addPage({ margin: 0, size: 'A4' });
      }

      const companyTerms = invoice.terms || config.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
      const items = invoice.items || [];
      const allJobNumsSet = new Set();
      items.forEach(it => {
        if (it.jobNo) {
          const matches = String(it.jobNo).match(/\d+/g) || [];
          matches.forEach(n => allJobNumsSet.add(n));
        }
      });
      const jobNumArray = Array.from(allJobNumsSet);

      const jobCardMap = {};
      if (jobNumArray.length > 0) {
        try {
          const queryOr = [];
          jobNumArray.forEach(n => {
            queryOr.push({ jobNo: n }, { jobNo: `JOB NO.- ${n}` }, { jobNo: `JOB NO.-${n}` });
          });
          const foundJobCards = await JobCard.find({ $or: queryOr }).select('jobNo imageUrl1 imageUrl2 proofing.artworkUrl').lean();
          foundJobCards.forEach(jc => {
            const nums = String(jc.jobNo).match(/\d+/g) || [];
            nums.forEach(n => { if (!jobCardMap[n]) jobCardMap[n] = jc; });
          });
        } catch(e) {}
      }

      const itemImages = items.map(item => {
        let imgPath = resolveImagePath(item.imageUrl);
        if (!imgPath && item.jobNo) {
          const nums = String(item.jobNo).match(/\d+/g) || [];
          for (const num of nums) {
            const jd = jobCardMap[num];
            if (jd) {
              const url = jd.imageUrl1 || jd.imageUrl2 || jd.proofing?.artworkUrl;
              if (url) {
                imgPath = resolveImagePath(url);
                if (imgPath) break;
              }
            }
          }
        }
        return imgPath;
      });

      const taxType = invoice.taxType || (invoice.customer && invoice.customer.stateCode && String(invoice.customer.stateCode).trim() !== '24' ? 'IGST' : 'CGST_SGST');
      const isIgst = taxType === 'IGST';

      const hsnMap = {};
      items.forEach(it => {
        const hsn  = it.hsnCode || '998821';
        const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : 5);
        const key  = `${hsn}_${rate}`;
        if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        const taxable = Number(it.totalAmount || 0);
        hsnMap[key].taxable += taxable;
        if (isIgst) {
          hsnMap[key].igst += taxable * (rate / 100);
        } else {
          hsnMap[key].cgst += taxable * (rate / 2 / 100);
          hsnMap[key].sgst += taxable * (rate / 2 / 100);
        }
      });
      const hsnRows      = Object.values(hsnMap);
      const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
      const totalCgst    = hsnRows.reduce((s, r) => s + r.cgst,    0);
      const totalSgst    = hsnRows.reduce((s, r) => s + r.sgst,    0);
      const totalIgst    = hsnRows.reduce((s, r) => s + r.igst,    0);
      const totalTax     = isIgst ? totalIgst : (totalCgst + totalSgst);

      let delByVal = invoice.deliveryBy || '';
      if (!delByVal && Array.isArray(invoice.linkedChallanIds) && invoice.linkedChallanIds.length > 0) {
        try {
          const fChs = await FabricChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
          const sChs = await StitchingChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
          const allDel = [...fChs, ...sChs].map(c => c.deliveryBy).filter(Boolean);
          if (allDel.length > 0) delByVal = [...new Set(allDel)].join(', ');
        } catch(e) {}
      }
      if (!delByVal) delByVal = 'By Road';

      const useTwoPages = items.length > 5;

      const renderPage = (copyLabel, bw = false) => {
        const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;
        const PRP  = c('#4c1d95', '#000000');
        const PRPM = c('#6b21a8', '#000000');
        const PRPL = c('#ede9fe', '#f0f0f0');
        const S900 = c('#000000', '#000000');
        const S700 = c('#000000', '#000000');
        const S500 = c('#000000', '#000000');
        const S200 = c('#e2e8f0', '#cccccc');
        const S50  = c('#f8fafc', '#f9f9f9');
        const WHT  = '#ffffff';

        const drawHeader = (pageLabel) => {
          let Y = PAD;

          doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);
          doc.rect(PAD, Y, CW, 4).fill(PRP);
          Y += 4;

          const hdrH = 62;
          doc.rect(PAD, Y, CW, hdrH).fill(S50);

          if (fs.existsSync(logoPath)) {
            try { doc.image(logoPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
          }

          doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
            .text(`${companyDisplayName.toUpperCase()} (${companyGstin})`, PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text(companyAddress.toUpperCase(), PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
            .text(`PHONE: ${companyPhone}   STATE: ${companyState}, CODE: ${companyStateCode}`,
                  PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

          Y += hdrH;

          const titleH = 22;
          doc.rect(PAD, Y, CW, titleH).fill(PRPL);
          doc.fillColor(PRP).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', PAD, Y + 4, { width: CW, align: 'center' });
          doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
            .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
          Y += titleH;

          const cust   = invoice.customer || {};
          const halfCW = Math.floor(CW / 2);
          const rawChallanStr = invoice.ourChallanNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '--';
          const custNameStr   = cust.businessName || cust.name || '--';
          const custGstStr    = cust.gstin && cust.gstin !== 'N/A' ? ` (GST: ${cust.gstin})` : '';
          const fullCustTitle = `${custNameStr}${custGstStr}`;

          let custY = Y + 16;
          doc.font('Helvetica-Bold').fontSize(9.5);
          custY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

          if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
            doc.font('Helvetica').fontSize(8);
            custY += doc.heightOfString(cust.billingAddress.trim(), { width: halfCW - 10 }) + 3;
          }
          custY += 14;

          const rx = PAD + halfCW;
          const metaW = (CW - halfCW) / 2 - 5;
          const pairs = [
            ['Challan No.', rawChallanStr, 'Tax Invoice No.', invoice.invoiceNo || '--'],
            ['', '', 'Terms of Delivery', delByVal],
          ];
          if (useTwoPages && pageLabel) {
            pairs.push(['Page', pageLabel, '', '']);
          }

          let testMetaY = Y + 16;
          pairs.forEach(([k1, v1, k2, v2]) => {
            doc.font('Helvetica-Bold').fontSize(8);
            const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
            const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
            const leftH = (k1 ? 8 : 0) + vh1;
            const rightH = (k2 ? 8 : 0) + vh2;
            const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;
            testMetaY += rowH;
          });

          const infoH = Math.max(76, custY - Y, testMetaY - Y + 4);

          doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
          doc.rect(PAD, Y, halfCW, 14).fill(PRP);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('BILL TO', PAD + 5, Y + 3, { width: halfCW - 10 });

          let drawCustY = Y + 16;
          doc.fillColor(S900).fontSize(9.5).font('Helvetica-Bold')
            .text(fullCustTitle, PAD + 5, drawCustY, { width: halfCW - 10 });
          drawCustY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

          if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
            const addrStr = cust.billingAddress.trim();
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(addrStr, PAD + 5, drawCustY, { width: halfCW - 10 });
            doc.font('Helvetica').fontSize(8);
            drawCustY += doc.heightOfString(addrStr, { width: halfCW - 10 }) + 3;
          }

          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, drawCustY);

          doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
          doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });

          let metaY = Y + 16;
          pairs.forEach(([k1, v1, k2, v2]) => {
            doc.font('Helvetica-Bold').fontSize(8);
            const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
            const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
            const leftH = (k1 ? 8 : 0) + vh1;
            const rightH = (k2 ? 8 : 0) + vh2;
            const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;

            if (k1 || v1) {
              if (k1) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text(k1 + ':', rx + 4, metaY, { width: metaW });
              }
              if (v1) {
                const valY = k1 ? metaY + 8 : metaY;
                doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                  .text(v1, rx + 4, valY, { width: metaW });
              }
            }
            if (k2 || v2) {
              if (k2) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
              }
              if (v2) {
                const valY = k2 ? metaY + 8 : metaY;
                doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                  .text(v2, rx + metaW + 10, valY, { width: metaW });
              }
            }
            metaY += rowH;
          });

          Y += infoH;
          return Y;
        };

        const drawItemsTable = (startY, itemsToRender, startIdx, isLastPage, minBottomY) => {
          let Y = startY;

          const tblHdrH = 22;
          doc.rect(PAD, Y, CW, tblHdrH).fill(PRP);
          doc.fillColor(WHT).fontSize(9.5).font('Helvetica-Bold');
          const hdrs   = ['Sr.', 'Image', 'Description of Goods', 'HSN', 'GST%', 'Qty', 'Rate', 'Per', 'Amount'];
          const aligns = ['left','center','left','center','center','center','right','center','right'];
          hdrs.forEach((h, i) => doc.text(h, colX[i] + 2, Y + 7, { width: COL[i] - 4, align: aligns[i] }));
          Y += tblHdrH;

          const drawColSeps = (rowY, rowH) => {
            colX.slice(1).forEach(cx => {
              doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(S200).lineWidth(0.4).stroke();
            });
          };

          let targetRowHPerItem = 34;
          if (!isLastPage && itemsToRender.length > 0) {
            const pageBottomLimit = PH - PAD - 22;
            const availableSpace = pageBottomLimit - startY - tblHdrH;
            if (availableSpace > 0) {
              targetRowHPerItem = Math.floor(availableSpace / itemsToRender.length);
            }
          }

          itemsToRender.forEach((item, localIdx) => {
            const idx = startIdx + localIdx;
            const rowBg = localIdx % 2 === 0 ? WHT : S50;

            const metaLines = [];
            const jd = cleanJobDisplay(item.jobNo);
            if (jd) metaLines.push({ text: jd, font: 'Helvetica-Bold', size: 8.5, color: PRPM });
            const p1 = [];
            if (item.lotNo)        p1.push(`Lot: ${item.lotNo}`);
            if (item.partyChallan) p1.push(`Vendor Challan: ${item.partyChallan}`);
            if (p1.length) metaLines.push({ text: p1.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
            const p2 = [];
            if (item.description)  p2.push(item.description);
            if (p2.length) metaLines.push({ text: p2.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
            if (item.fabric) metaLines.push({ text: `Fabric: ${item.fabric}`, font: 'Helvetica', size: 8, color: S500 });

            doc.font('Helvetica-Bold').fontSize(11);
            let descH = doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 });
            metaLines.forEach(m => {
              doc.font(m.font).fontSize(m.size);
              descH += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
            });
            const rowH = Math.max(targetRowHPerItem, descH + 10);

            doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
            drawColSeps(Y, rowH);

            const contentPadY = Math.max(6, Math.floor((rowH - Math.max(34, descH)) / 2));

            doc.fillColor(S700).fontSize(10).font('Helvetica-Bold')
              .text(String(idx + 1), colX[0] + 3, Y + contentPadY, { width: COL[0] - 3 });

            const imgPath = itemImages[idx];
            const imgMaxW = COL[1] - 6;
            const imgMaxH = Math.min(rowH - 10, 100);

            if (imgPath && fs.existsSync(imgPath)) {
              try {
                doc.image(imgPath, colX[1] + 3, Y + 5, { width: imgMaxW, height: imgMaxH, fit: [imgMaxW, imgMaxH], align: 'center', valig: 'center' });
              } catch(e) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text('[Img Err]', colX[1] + 2, Y + 12, { width: COL[1] - 4, align: 'center' });
              }
            } else {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text('NO IMAGE', colX[1] + 2, Y + Math.floor(rowH / 2) - 4, { width: COL[1] - 4, align: 'center' });
            }

            let descY = Y + contentPadY;
            doc.fillColor(S900).fontSize(11).font('Helvetica-Bold')
              .text(item.itemName || '--', colX[2] + 3, descY, { width: COL[2] - 6 });
            descY += doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 }) + 2;

            metaLines.forEach(m => {
              doc.fillColor(m.color).fontSize(m.size).font(m.font)
                .text(m.text, colX[2] + 3, descY, { width: COL[2] - 6 });
              descY += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
            });

            doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
              .text(item.hsnCode || '998821', colX[3] + 2, Y + contentPadY, { width: COL[3] - 4, align: 'center' });

            const gstVal = item.taxRate !== undefined && item.taxRate !== null ? `${item.taxRate}%` : '5%';
            doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
              .text(gstVal, colX[4] + 2, Y + contentPadY, { width: COL[4] - 4, align: 'center' });

            const qtyVal = Number(item.qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
            doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
              .text(qtyVal, colX[5] + 2, Y + contentPadY, { width: COL[5] - 4, align: 'center' });

            const rateVal = Number(item.unitPrice || 0).toFixed(2);
            doc.fillColor(S700).fontSize(9.5).font('Helvetica')
              .text(rateVal, colX[6] + 2, Y + contentPadY, { width: COL[6] - 4, align: 'right' });

            doc.fillColor(S500).fontSize(8.5).font('Helvetica')
              .text(item.unit || 'Mtr', colX[7] + 2, Y + contentPadY, { width: COL[7] - 4, align: 'center' });

            const amtVal = Number(item.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
              .text(amtVal, colX[8] + 2, Y + contentPadY, { width: COL[8] - 4, align: 'right' });

            Y += rowH;
          });

          if (isLastPage) {
            const remainingSpace = minBottomY - Y;
            if (remainingSpace > 0) {
              doc.rect(PAD, Y, CW, remainingSpace).fill(WHT).stroke(S200);
              drawColSeps(Y, remainingSpace);
              Y = minBottomY;
            }

            const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
            const subtotal = invoice.subtotal || totalTaxable;
            const totalH   = 22;

            doc.rect(PAD, Y, CW, totalH).fill(PRPL).stroke(S200);
            drawColSeps(Y, totalH);

            doc.fillColor(PRP).fontSize(9.5).font('Helvetica-Bold')
              .text('TOTAL:', colX[0] + 3, Y + 6);
            doc.fillColor(PRP).fontSize(9.5).font('Helvetica-Bold')
              .text(totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 }), colX[5] + 2, Y + 6, { width: COL[5] - 4, align: 'center' });
            doc.fillColor(PRP).fontSize(10).font('Helvetica-Bold')
              .text(`Rs. ${Number(subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    colX[8] + 2, Y + 6, { width: COL[8] - 4, align: 'right' });
            Y += totalH;
          }

          return Y;
        };

        const drawSummary = (startY) => {
          let Y = startY;

          const sumHdrH = 16;
          doc.rect(PAD, Y, CW, sumHdrH).fill(PRP);
          doc.fillColor(WHT).fontSize(8).font('Helvetica-Bold');
          doc.text('HSN/SAC', colX[0] + 2, Y + 4, { width: COL[0] + COL[1] + COL[2] - 4 });
          doc.text('Taxable Value', colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

          if (isIgst) {
            doc.text('IGST Amount', colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
          } else {
            doc.text('Central Tax (CGST)', colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'center' });
            doc.text('State Tax (SGST)',   colX[7] + 2, Y + 4, { width: COL[7] + COL[8] - 4, align: 'center' });
          }
          Y += sumHdrH;

          if (!isIgst) {
            const subHdrH = 14;
            doc.rect(PAD, Y, CW, subHdrH).fill(PRPL);
            doc.fillColor(PRP).fontSize(7.5).font('Helvetica-Bold');
            doc.text('Rate', colX[5] + 2, Y + 3, { width: COL[5] - 2, align: 'center' });
            doc.text('Amount', colX[6] + 2, Y + 3, { width: COL[6] - 2, align: 'right' });
            doc.text('Rate', colX[7] + 2, Y + 3, { width: COL[7] - 2, align: 'center' });
            doc.text('Amount', colX[8] + 2, Y + 3, { width: COL[8] - 2, align: 'right' });
            Y += subHdrH;
          }

          hsnRows.forEach((r, idx) => {
            const hsnRowBg = idx % 2 === 0 ? WHT : S50;
            const rowH = 16;
            doc.rect(PAD, Y, CW, rowH).fill(hsnRowBg).stroke(S200);

            doc.fillColor(S900).fontSize(8).font('Helvetica')
              .text(r.hsn, colX[0] + 2, Y + 4, { width: COL[0] + COL[1] + COL[2] - 4 });
            doc.fillColor(S900).fontSize(8).font('Helvetica')
              .text(r.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

            if (isIgst) {
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
            } else {
              const halfRate = (r.rate / 2).toFixed(1) + '%';
              doc.fillColor(S700).fontSize(7.5).font('Helvetica')
                .text(halfRate, colX[5] + 2, Y + 4, { width: COL[5] - 2, align: 'center' });
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[6] + 2, Y + 4, { width: COL[6] - 2, align: 'right' });

              doc.fillColor(S700).fontSize(7.5).font('Helvetica')
                .text(halfRate, colX[7] + 2, Y + 4, { width: COL[7] - 2, align: 'center' });
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[8] + 2, Y + 4, { width: COL[8] - 2, align: 'right' });
            }
            Y += rowH;
          });

          const totH = 16;
          doc.rect(PAD, Y, CW, totH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total Tax:', colX[0] + 2, Y + 4);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

          if (isIgst) {
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
          } else {
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[6] + 2, Y + 4, { width: COL[6] - 2, align: 'right' });
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[8] + 2, Y + 4, { width: COL[8] - 2, align: 'right' });
          }
          Y += totH;

          const gtotBoxH = 22;
          doc.rect(PAD, Y, CW, gtotBoxH).fill(PRP);

          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('Grand Total (in words):', PAD + 4, Y + 4, { width: 140 });

          const grandTotalVal = invoice.grandTotal || (totalTaxable + totalTax);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text(numToWords(grandTotalVal), PAD + 148, Y + 4, { width: CW - 260 });

          doc.fillColor(WHT).fontSize(11).font('Helvetica-Bold')
            .text(`Rs. ${Number(grandTotalVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  PAD + CW - 110, Y + 5, { width: 105, align: 'right' });
          Y += gtotBoxH;

          const roundOffVal = invoice.roundOff != null ? Number(invoice.roundOff) : 0;
          doc.rect(PAD, Y, CW, 16).fill(S50).stroke(S200);
          doc.fillColor(S700).fontSize(8).font('Helvetica')
            .text(`Round Off: ${roundOffVal !== 0 ? (roundOffVal > 0 ? '+' : '') + ' Rs. ' + roundOffVal.toFixed(2) : 'Rs. 0.00'}`, PAD + 5, Y + 3);
          Y += 16;

          doc.rect(PAD, Y, CW, 16).fill(WHT).stroke(S200);
          doc.fillColor(S500).fontSize(7.5).font('Helvetica')
            .text('Tax Amount (in words):', PAD + 2, Y + 2)
            .text(numToWords(totalTax), PAD + 105, Y + 2, { width: CW - 109 });
          Y += 16;

          return Y;
        };

        const drawFooter = (startY) => {
          const minFooterY = PH - PAD - 72;
          const validStartY = (typeof startY === 'number' && !isNaN(startY)) ? startY : minFooterY - 8;
          const footerY = Math.max(validStartY + 8, minFooterY);
          doc.moveTo(PAD, footerY).lineTo(PAD + CW, footerY).strokeColor(S200).lineWidth(0.6).stroke();

          const leftFW = 300;
          const rightFX = PAD + leftFW + 8;
          const rightFW = CW - leftFW - 8;

          doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
            .text("Company's Bank Details:", PAD + 4, footerY + 5);
          doc.fillColor(S700).fontSize(8).font('Helvetica')
            .text(`Bank Name: ${bankName}`, PAD + 4, footerY + 16)
            .text(`A/c No.: ${bankAcNo}`, PAD + 4, footerY + 26)
            .text(`Branch & IFS Code: ${bankIfsc}`, PAD + 4, footerY + 36);
          doc.fillColor(S500).fontSize(6.5).font('Helvetica')
            .text('Terms & Conditions:', PAD + 4, footerY + 50)
            .text(companyTerms, PAD + 4, footerY + 58, { width: leftFW });

          doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
            .text(`for ${companyDisplayName.toUpperCase()}`, rightFX, footerY + 5, { width: rightFW, align: 'right' });
          doc.moveTo(rightFX + rightFW - 100, footerY + 48).lineTo(rightFX + rightFW, footerY + 48)
            .strokeColor(S500).lineWidth(0.5).stroke();
          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text('Authorised Signatory', rightFX, footerY + 50, { width: rightFW, align: 'right' });

          const bottomNoteY = PH - PAD - 14;
          doc.moveTo(PAD, bottomNoteY).lineTo(PAD + CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
          doc.fillColor(S500).fontSize(7).font('Helvetica')
            .text('This is a Computer Generated Document', PAD, bottomNoteY + 3, { width: CW, align: 'center' });
        };

        const sumH = isIgst
          ? (16 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)
          : (32 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16);
        const minBottomY = PH - PAD - 76 - sumH;

        if (useTwoPages) {
          let Y = drawHeader('1 of 2');
          Y = drawItemsTable(Y, items.slice(0, 5), 0, false);
          doc.rect(PAD, PH - PAD - 20, CW, 20).fill(PRPL);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text(`Continued on Page 2  ›  GST Summary & Payment Details  (Invoice: ${invoice.invoiceNo})`, PAD, PH - PAD - 13, { width: CW, align: 'center' });

          doc.addPage({ margin: 0, size: 'A4' });
          Y = drawHeader('2 of 2');
          doc.rect(PAD, Y, CW, 18).fill(PRPL);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text(`‹  ${invoice.invoiceNo}  —  Tax Summary & Payment Details  (${items.length} Line Items)`, PAD, Y + 5, { width: CW, align: 'center' });
          Y += 18;

          Y = drawItemsTable(Y, items.slice(5), 5, true, minBottomY);
          Y = drawSummary(Y);
          drawFooter(Y);
        } else {
          let Y = drawHeader('');
          Y = drawItemsTable(Y, items, 0, true, minBottomY);
          Y = drawSummary(Y);
          drawFooter(Y);
        }
      };

      renderPage('ORIGINAL FOR BUYER', false);
    }

    console.log(`[Bulk PDF Performance] ${invoices.length} Invoices generated into single combined PDF in ${Date.now() - startTime}ms`);
    doc.end();

  } catch (error) {
    console.error('Download Bulk Invoice PDF Error:', error);
    res.status(500).send('Error generating bulk combined PDF invoice');
  }
};


// ── 10. CUSTOMER CRUD ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const customers = await BillingCustomer.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const customer = await BillingCustomer.create(req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await BillingCustomer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await BillingCustomer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 11. ITEM CRUD ────────────────────────────────────────────────────────────
const getItems = async (req, res) => {
  try {
    const items = await BillingItem.find().sort({ itemName: 1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createItem = async (req, res) => {
  try {
    const item = await BillingItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await BillingItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await BillingItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Billing item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getBillingDashboardStats,
  getInvoices,
  getInvoiceById,
  getNextInvoiceNo,
  createInvoice,
  updateInvoice,
  mergeChallans,
  deleteInvoice,
  recordPayment,
  downloadInvoicePdf,
  downloadBulkInvoicesPdf,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getItems,
  createItem,
  updateItem,
  deleteItem
};
