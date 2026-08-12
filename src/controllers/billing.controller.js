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
    const { search, paymentStatus, page = 1, limit = 20, dateStart, dateEnd } = req.query;

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
      filter.invoiceDate = {};
      if (dateStart) filter.invoiceDate.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = end;
      }
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

    // 2. SAME-CUSTOMER VALIDATION CHECK
    const normalizeName = (s) => (s || '').trim().toLowerCase();
    const customerNames = new Set(
      allChallans.map(ch => normalizeName(ch.billTo || ch.partyName)).filter(Boolean)
    );

    if (customerNames.size > 1) {
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

    res.json({
      success: true,
      data: {
        customer: customerObj,
        items,
        linkedChallanIds,
        linkedChallanNos
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
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).send('Invoice not found');

    const includeDuplicate = req.query.duplicate === 'true';

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const companyName    = config.companyName    || 'ELITE DIGITAL PRINTS';
    const companyGstin   = config.companyGstin   || '24AAAFE1234F1Z5';
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
    // Sr | IMG | Description | HSN | GST% | Qty | Rate | Per | Amount
    const COL = [18, 100, 132, 54, 34, 60, 60, 30, 71.28]; // sum=559.28 ✓
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    // ── PRE-LOAD IMAGES ──────────────────────────────────────────────────────────
    const itemImages = [];
    const items = invoice.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let imgPath = resolveImagePath(item.imageUrl);
      if (!imgPath && item.jobNo) {
        try {
          const nums = String(item.jobNo).match(/\d+/g) || [];
          for (const num of nums) {
            const jd = await JobCard.findOne({ $or: [
              { jobNo: num }, { jobNo: `JOB NO.- ${num}` },
              { jobNo: `JOB NO.-${num}` }, { jobNo: { $regex: num, $options: 'i' } }
            ]}).lean();
            if (jd) {
              const url = jd.imageUrl1 || jd.imageUrl2 || jd.proofing?.artworkUrl;
              if (url) { imgPath = resolveImagePath(url); if (imgPath) break; }
            }
          }
        } catch(e) {}
      }
      itemImages.push(imgPath);
    }

    // ── TAX COMPUTATION ──────────────────────────────────────────────────────────
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

    // ── PAGE RENDERER ────────────────────────────────────────────────────────────
    // bw = true → renders entire page in black & white (duplicate copy)
    const renderPage = (copyLabel, bw = false) => {
      // Colour palette — overridden to grayscale if bw=true
      const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;

      const PRP  = c('#4c1d95', '#000000');  // deep purple   → black in B&W
      const PRPM = c('#6b21a8', '#000000');  // mid purple    → black in B&W
      const PRPL = c('#ede9fe', '#f0f0f0');  // light purple  → light gray
      const S900 = c('#000000', '#000000');  // pure black
      const S700 = c('#000000', '#000000');  // pure black (was gray)
      const S500 = c('#000000', '#000000');  // pure black (was gray)
      const S200 = c('#e2e8f0', '#cccccc');
      const S50  = c('#f8fafc', '#f9f9f9');
      const WHT  = '#ffffff';

      let Y = PAD;

      // ── OUTER BORDER ──────────────────────────────────────────────────────────
      doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);

      // ── TOP ACCENT BAR ────────────────────────────────────────────────────────
      doc.rect(PAD, Y, CW, 4).fill(PRP);


      Y += 4;


      // ── HEADER: LOGO LEFT / COMPANY RIGHT ─────────────────────────────────────
      const hdrH = 62;
      doc.rect(PAD, Y, CW, hdrH).fill(S50);

      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
      }

      doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
        .text(`${companyName.toUpperCase()} (${companyGstin})`, PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text('G.F., PLOT NO-B/37, SIDDHESHWAR SOC., PUNAGAM MAIN ROAD, SURAT - 395010', PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
        .text(`PHONE: +91 99098 66667   STATE: GUJARAT, CODE: 24`,
              PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

      Y += hdrH;

      // ── TAX INVOICE TITLE ─────────────────────────────────────────────────────
      const titleH = 22;
      doc.rect(PAD, Y, CW, titleH).fill(PRPL);
      doc.fillColor(PRP).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', PAD, Y + 4, { width: CW, align: 'center' });

      doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
        .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
      Y += titleH;

      // ── BUYER / SELLER INFO ───────────────────────────────────────────────────
      const cust   = invoice.customer || {};
      const infoH  = 72;
      const halfCW = Math.floor(CW / 2);

      // Left: Buyer
      doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
      doc.rect(PAD, Y, halfCW, 14).fill(PRP);
      doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
        .text('BUYER (BILLED TO)', PAD + 5, Y + 3, { width: halfCW - 10 });
      doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
        .text(cust.businessName || cust.name || '--', PAD + 5, Y + 16, { width: halfCW - 10 });
      doc.fillColor(S700).fontSize(8.5).font('Helvetica')
        .text(cust.billingAddress || '--', PAD + 5, Y + 28, { width: halfCW - 10 });
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text(`GST: ${cust.gstin || 'N/A'}`, PAD + 5, Y + 46)
        .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, Y + 56);

      // Right: Seller/meta
      const rx = PAD + halfCW;
      doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
      doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
      doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
        .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });
      const metaW = (CW - halfCW) / 2 - 5;
      // Show only: Tax Invoice No., Challan No., Terms, Place of Supply
      const pairs = [
        ['Tax Invoice No.', invoice.invoiceNo || '--', 'Challan No.', invoice.ourChallanNo || invoice.challanNo || '--'],
        ['Terms of Delivery', 'By Road', 'Place of Supply', `${cust.state || 'Gujarat'} (${cust.stateCode || '24'})`],
      ];
      let metaY = Y + 16;
      pairs.forEach(([k1, v1, k2, v2]) => {
        doc.fillColor(S500).fontSize(7.5).font('Helvetica')
          .text(k1 + ':', rx + 4, metaY, { width: metaW })
          .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(v1, rx + 4, metaY + 9, { width: metaW })
          .text(v2, rx + metaW + 10, metaY + 9, { width: metaW });
        metaY += 18;
      });
      Y += infoH;

      // ── DYNAMIC 1-PAGE TABLE HEIGHT CALCULATION ─────────────────────────────
      const fixedTopH = PAD + 4 + 52 + 22 + 72 + 22; // 190
      const bottomSummaryH = (hsnRows.length * 48) + 22 + 28 + 18 + (hsnRows.length * 16) + 17 + 16 + 78 + PAD;
      const availableItemsH = PH - fixedTopH - bottomSummaryH;
      const minRowHPerItem = Math.floor(availableItemsH / Math.max(items.length, 1));

      // ── ITEMS TABLE HEADER ───────────────────────────────────────────────────
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

      // ── ITEM ROWS ────────────────────────────────────────────────────────────
      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? WHT : S50;

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
        const rowH = Math.max(minRowHPerItem, descH + 14);

        doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
        drawColSeps(Y, rowH);

        doc.fillColor(S700).fontSize(10).font('Helvetica-Bold')
          .text(String(idx + 1), colX[0] + 3, Y + 6, { width: COL[0] - 3 });

        // Image — large thumbnail up to 110px
        const imgPath = itemImages[idx];
        const imgMaxW = COL[1] - 6; // 94px
        const imgMaxH = Math.min(rowH - 10, 115);
        if (imgPath && fs.existsSync(imgPath)) {
          try {
            doc.image(imgPath, colX[1] + 3, Y + 5, { fit: [imgMaxW, imgMaxH] });
          } catch(e) {
            doc.fillColor(S200).fontSize(7).font('Helvetica')
              .text('N/A', colX[1], Y + 12, { width: COL[1], align: 'center' });
          }
        } else {
          doc.fillColor(S200).fontSize(7).font('Helvetica')
            .text('N/A', colX[1], Y + 12, { width: COL[1], align: 'center' });
        }

        let textY = Y + 5;
        doc.fillColor(S900).font('Helvetica').fontSize(11);
        doc.text(item.itemName || '--', colX[2] + 3, textY, { width: COL[2] - 6 });
        textY += doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 }) + 2;
        metaLines.forEach(m => {
          doc.font(m.font).fontSize(m.size).fillColor(m.color);
          doc.text(m.text, colX[2] + 3, textY, { width: COL[2] - 6 });
          textY += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
        });

        const numY    = Y + 6;
        const taxRate = item.taxRate || 18;
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

      // ── TAX ROWS (IGST vs CGST/SGST) ─────────────────────────────────────────
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

      // ── ROUND OFF ROW ────────────────────────────────────────────────────────
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

      // ── GRAND TOTAL ───────────────────────────────────────────────────────────
      const totH = 22;
      doc.rect(PAD, Y, CW, totH).fill(PRP);
      doc.fillColor(WHT).fontSize(10).font('Helvetica-Bold')
        .text('Total', colX[6] - 20, Y + 6, { width: COL[6] + COL[7] + 16, align: 'right' })
        .text(`Rs. ${Number(invoice.grandTotal||0).toFixed(2)}`, colX[8] + 2, Y + 6, { width: COL[8]-4, align: 'right' });
      Y += totH;

      // ── AMOUNT IN WORDS ───────────────────────────────────────────────────────
      const wordsH = 28;
      doc.rect(PAD, Y, CW, wordsH).fill(S50).stroke(S200);
      doc.fillColor(S700).fontSize(7.5).font('Helvetica-Bold')
        .text('Amount Chargeable (in words):', PAD + 5, Y + 4);
      doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
        .text(numToWords(invoice.grandTotal), PAD + 5, Y + 14, { width: CW - 80 });
      doc.fillColor(S500).fontSize(7).font('Helvetica')
        .text('E. & O.E.', PAD + CW - 55, Y + 14, { width: 50, align: 'right' });
      Y += wordsH;

      // ── 9. GST TAX SUMMARY TABLE ─────────────────────────────────────────────
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

        // Tax totals row
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

        // Tax totals row
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

      // ── FOOTER ────────────────────────────────────────────────────────────────
      const footerY = PH - PAD - 70;
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
        .text(`for ${companyName.toUpperCase()}`, rightFX, footerY+5, { width: rightFW, align:'right' });
      doc.moveTo(rightFX + rightFW - 100, footerY + 48).lineTo(rightFX + rightFW, footerY + 48)
        .strokeColor(S500).lineWidth(0.5).stroke();
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text('Authorised Signatory', rightFX, footerY+50, { width: rightFW, align:'right' });

      const bottomNoteY = PH - PAD - 14;
      doc.moveTo(PAD, bottomNoteY).lineTo(PAD+CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
      doc.fillColor(S500).fontSize(7).font('Helvetica')
        .text('This is a Computer Generated Document', PAD, bottomNoteY+3, { width: CW, align:'center' });
    };

    // ── RENDER PAGES ──────────────────────────────────────────────────────────
    // Page 1: Colourful original
    renderPage('ORIGINAL FOR BUYER', false);

    // Page 2 (only if duplicate requested): Black & White duplicate
    if (includeDuplicate) {
      doc.addPage();
      renderPage('DUPLICATE COPY', true);
    }

    doc.end();

  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    res.status(500).send('Error generating PDF invoice');
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
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getItems,
  createItem,
  updateItem,
  deleteItem
};
