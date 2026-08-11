const BillingInvoice = require('../db/models/billingInvoice.model');
const BillingCustomer = require('../db/models/billingCustomer.model');
const BillingItem = require('../db/models/billingItem.model');
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
    res.json({ success: true, data: invoice });
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
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};
    const companyName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyGstin = config.companyGstin || '24AAAFE1234F1Z5';
    const companyAddress = config.companyAddress || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone = config.companyPhone || '+91 98790 00000';
    const companyTerms = invoice.terms || config.companyTerms || 'Payment due within 15 days from invoice date.';

    const doc = new PDFDocument({ margin: 18, size: 'A4', autoFirstPage: true, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 20, MR = 20;
    const contentWidth = PW - ML - MR; // 555px
    const logoPath = path.join(__dirname, 'Logo.png');

    // Case-insensitive image path resolver for PDF items
    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').trim();
      try { filename = decodeURIComponent(filename); } catch (e) {}

      const possibleDirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../../../elite_edition_images'),
        '/home/ubuntu/elite_edition_images',
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        path.join(__dirname, '../../../Digital print'),
        '/home/ubuntu/Digital print'
      ];

      for (const pDir of possibleDirs) {
        if (fs.existsSync(pDir)) {
          const direct = path.join(pDir, filename);
          if (fs.existsSync(direct)) return direct;
          try {
            const files = fs.readdirSync(pDir);
            const lowerFilename = filename.toLowerCase();
            const matched = files.find(f => f.toLowerCase() === lowerFilename);
            if (matched) return path.join(pDir, matched);
          } catch (e) {}
        }
      }
      return null;
    };

    // 2% Page Top Padding / Header Logo & Company Info
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, ML, 18, { width: 120 });
    }

    doc.fillColor('#0f172a').fontSize(15).font('Helvetica-Bold')
      .text(companyName.toUpperCase(), ML + 140, 18, { width: contentWidth - 140, align: 'right' });
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(companyAddress, ML + 140, 36, { width: contentWidth - 140, align: 'right' })
      .text(`GSTIN: ${companyGstin}  |  Phone: ${companyPhone}`, ML + 140, 48, { width: contentWidth - 140, align: 'right' });

    doc.moveTo(ML, 62).lineTo(PW - MR, 62).strokeColor('#7c3aed').lineWidth(1.5).stroke();

    // Tax Invoice Badge & Metadata Box
    doc.rect(ML, 68, contentWidth, 48).fill('#f8fafc').stroke('#e2e8f0');

    doc.fillColor('#6b21a8').fontSize(13).font('Helvetica-Bold')
      .text('TAX INVOICE', ML + 12, 74);
    
    const ourChallanStr = invoice.ourChallanNo || invoice.challanNo || '';
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(`Invoice No: ${invoice.invoiceNo}`, ML + 12, 90)
      .text(ourChallanStr ? `Our Challan No: ${ourChallanStr}` : '', ML + 150, 90);

    const formatDDMMYYYY = (d) => {
      if (!d) return '—';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${dt.getFullYear()}`;
    };
    const invDateStr = formatDDMMYYYY(invoice.invoiceDate);
    const dueDateStr = formatDDMMYYYY(invoice.dueDate);

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(`Date: ${invDateStr}`, ML + 300, 74, { width: contentWidth - 300, align: 'right' })
      .text(`Due Date: ${dueDateStr}`, ML + 300, 88, { width: contentWidth - 300, align: 'right' });

    // Customer Details Box (BILLED TO & SHIPPED TO 2-Column Layout)
    const custY = 122;
    const colW = (contentWidth - 10) / 2; // 272.5px each

    // Left Column: BILLED TO
    doc.rect(ML, custY, colW, 64).fill('#f1f5f9').stroke('#cbd5e1');
    const cust = invoice.customer || {};

    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
      .text('BILLED TO (CUSTOMER):', ML + 8, custY + 6);
    doc.fillColor('#334155').fontSize(8).font('Helvetica')
      .text(`${cust.businessName ? cust.businessName + ' (' + cust.name + ')' : cust.name || '—'}`, ML + 8, custY + 18, { width: colW - 16, lineBreak: false, ellipsis: true })
      .text(`GSTIN: ${cust.gstin || 'N/A'}  |  Phone: ${cust.phone || '—'}`, ML + 8, custY + 30, { width: colW - 16, lineBreak: false, ellipsis: true })
      .text(`Address: ${cust.billingAddress || '—'}`, ML + 8, custY + 42, { width: colW - 16, lineBreak: false, ellipsis: true });

    // Right Column: SHIPPED TO
    doc.rect(ML + colW + 10, custY, colW, 64).fill('#f1f5f9').stroke('#cbd5e1');
    const shipAddr = cust.shippingAddress || cust.billingAddress || 'Same as Billing Address';

    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
      .text('SHIPPED TO:', ML + colW + 18, custY + 6);
    doc.fillColor('#334155').fontSize(8).font('Helvetica')
      .text(`${cust.businessName || cust.name || '—'}`, ML + colW + 18, custY + 18, { width: colW - 16, lineBreak: false, ellipsis: true })
      .text(`State: ${cust.state || 'Gujarat'} (${cust.stateCode || '24'})`, ML + colW + 18, custY + 30, { width: colW - 16, lineBreak: false, ellipsis: true })
      .text(`Address: ${shipAddr}`, ML + colW + 18, custY + 42, { width: colW - 16, lineBreak: false, ellipsis: true });

    // Helper to format job card display string
    const cleanJobDisplay = (jobStr) => {
      if (!jobStr) return '';
      const str = String(jobStr);
      const matches = str.match(/\d+/g);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        if (unique.length === 1) return `Job Card: ${unique[0]}`;
        return `Job Cards: ${unique.join(', ')}`;
      }
      return str.replace(/JOB NO\.-?\s*/gi, '').replace(/Job\s*#?\s*/gi, '').trim();
    };

    // Items Table Header
    let tableY = 194;
    doc.rect(ML, tableY, contentWidth, 22).fill('#4c1d95');

    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
    doc.text('#', ML + 4, tableY + 6, { width: 16 });
    doc.text('IMAGE', ML + 22, tableY + 6, { width: 36, align: 'center' });
    doc.text('ITEM DESCRIPTION & DETAILS', ML + 62, tableY + 6, { width: 198 });
    doc.text('HSN/SAC', ML + 265, tableY + 6, { width: 50, align: 'center' });
    doc.text('QTY / MTRS', ML + 320, tableY + 6, { width: 60, align: 'center' });
    doc.text('RATE (Rs.)', ML + 385, tableY + 6, { width: 60, align: 'right' });
    doc.text('AMOUNT (Rs.)', ML + 450, tableY + 6, { width: contentWidth - 455, align: 'right' });

    tableY += 22;

    // Items Rows (Render Image Thumbnail, Clean Job Cards, Lot No, Party Challan, Our Challan)
    const items = invoice.items || [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      // Build clean multi-line metadata structure
      const metaLines = [];
      const formattedJobs = cleanJobDisplay(item.jobNo);
      if (formattedJobs) metaLines.push(formattedJobs);

      const secondaryBadges = [];
      if (item.lotNo) secondaryBadges.push(`Lot #: ${item.lotNo}`);
      if (item.partyChallan) secondaryBadges.push(`Party Challan #: ${item.partyChallan}`);
      if (item.ourChallanNo) secondaryBadges.push(`Our Challan #: ${item.ourChallanNo}`);

      if (secondaryBadges.length > 0) metaLines.push(secondaryBadges.join('   •   '));
      if (item.description) metaLines.push(item.description);

      // Multi-Job Image Lookup
      let resolvedImgPath = resolveImagePath(item.imageUrl);
      if (!resolvedImgPath && item.jobNo) {
        try {
          const nums = String(item.jobNo).match(/\d+/g) || [];
          for (const num of nums) {
            const jobDoc = await JobCard.findOne({
              $or: [
                { jobNo: num },
                { jobNo: `JOB NO.- ${num}` },
                { jobNo: `JOB NO.-${num}` },
                { jobNo: { $regex: num, $options: 'i' } }
              ]
            }).lean();

            if (jobDoc) {
              const imgUrl = jobDoc.imageUrl1 || jobDoc.imageUrl2 || jobDoc.proofing?.artworkUrl;
              if (imgUrl) {
                resolvedImgPath = resolveImagePath(imgUrl);
                if (resolvedImgPath) break;
              }
            }
          }
        } catch (e) {}
      }

      // Calculate dynamic row height
      const totalTextLines = 1 + metaLines.length; // Item title + metadata lines
      const rowHeight = Math.max(42, 14 + (totalTextLines * 13));

      doc.rect(ML, tableY, contentWidth, rowHeight).fill(rowBg).stroke('#e2e8f0');

      // Row Index #
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
      doc.text(String(idx + 1), ML + 4, tableY + 8, { width: 16 });

      // Thumbnail Image
      if (resolvedImgPath && fs.existsSync(resolvedImgPath)) {
        try {
          const imgBoxSize = Math.min(32, rowHeight - 8);
          doc.image(resolvedImgPath, ML + 24, tableY + 4, {
            fit: [imgBoxSize, imgBoxSize],
            align: 'center',
            valign: 'center'
          });
        } catch (e) {
          doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
            .text('N/A', ML + 22, tableY + 12, { width: 36, align: 'center' });
        }
      } else {
        doc.fillColor('#cbd5e1').fontSize(7).font('Helvetica')
          .text('—', ML + 22, tableY + (rowHeight / 2 - 4), { width: 36, align: 'center' });
      }

      // Item Title (Bold 9pt)
      let textY = tableY + 6;
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
        .text(item.itemName || '—', ML + 62, textY, { width: 198, lineBreak: false, ellipsis: true });

      textY += 13;

      // Meta Lines (8.2pt, structured)
      metaLines.forEach((mLine, mIdx) => {
        const isJobLine = mIdx === 0 && formattedJobs;
        doc.font(isJobLine ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8.2)
          .fillColor(isJobLine ? '#6b21a8' : '#475569')
          .text(mLine, ML + 62, textY, { width: 198, lineBreak: false, ellipsis: true });
        textY += 12;
      });

      // HSN, Qty, Rate, Amount (Centered / Vertically aligned)
      const alignY = tableY + 6;
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica');
      doc.text(item.hsnCode || '998821', ML + 265, alignY, { width: 50, align: 'center' });
      doc.font('Helvetica-Bold').text(`${item.qty} ${item.unit || ''}`, ML + 320, alignY, { width: 60, align: 'center' });
      doc.font('Helvetica').text(Number(item.unitPrice || 0).toFixed(2), ML + 385, alignY, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(Number(item.totalAmount || 0).toFixed(2), ML + 450, alignY, { width: contentWidth - 455, align: 'right' });

      tableY += rowHeight;
    }

    // Summary Box (Subtotal, Tax, Round Off, Grand Total)
    tableY += 10;

    const summaryBoxX = ML + contentWidth - 230;
    const summaryBoxHeight = 115;
    doc.rect(summaryBoxX, tableY, 230, summaryBoxHeight).fill('#f8fafc').stroke('#cbd5e1');

    let sumY = tableY + 8;
    doc.fillColor('#475569').fontSize(8).font('Helvetica');

    doc.text('Subtotal:', summaryBoxX + 10, sumY);
    doc.text(`Rs. ${Number(invoice.subtotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
    sumY += 13;

    if (invoice.discountTotal > 0) {
      doc.text('Discount:', summaryBoxX + 10, sumY);
      doc.text(`- Rs. ${Number(invoice.discountTotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
      sumY += 13;
    }

    if (invoice.taxType === 'IGST') {
      doc.text('IGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`Rs. ${Number(invoice.igstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
      sumY += 13;
    } else {
      doc.text('CGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`Rs. ${Number(invoice.cgstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
      sumY += 13;

      doc.text('SGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`Rs. ${Number(invoice.sgstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
      sumY += 13;
    }

    // Round Off Display (Always display Round Off details)
    const roundOffVal = Number(invoice.roundOff || 0);
    const sign = roundOffVal > 0 ? '+' : '';
    doc.fillColor('#6b21a8').fontSize(8).font('Helvetica-Bold')
      .text('Round Off:', summaryBoxX + 10, sumY);
    doc.text(`${sign} Rs. ${roundOffVal.toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });
    sumY += 13;

    doc.moveTo(summaryBoxX, sumY).lineTo(PW - MR, sumY).strokeColor('#cbd5e1').lineWidth(1).stroke();
    sumY += 4;

    doc.fillColor('#6b21a8').fontSize(9.5).font('Helvetica-Bold');
    doc.text('Grand Total:', summaryBoxX + 10, sumY);
    doc.text(`Rs. ${Number(invoice.grandTotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 210, align: 'right' });

    // Amount in Words
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text('Amount in Words:', ML, tableY + 5);
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(numToWords(invoice.grandTotal), ML, tableY + 18, { width: contentWidth - 240 });

    // ── FIXED BOTTOM FOOTER ────────
    const footerY = PH - 110;

    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
      .text('PAYMENT & BANK DETAILS:', ML, footerY);

    let payDetailsStr = `Bank: ${config.companyBankName || 'N/A'}  |  A/C No: ${config.companyAccountNo || 'N/A'}  |  IFSC: ${config.companyIfscCode || 'N/A'}`;

    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(payDetailsStr, ML, footerY + 13, { width: contentWidth });

    // Terms & Authorized Signatory Footer
    const termY = footerY + 32;
    doc.moveTo(ML, termY).lineTo(PW - MR, termY).strokeColor('#e2e8f0').lineWidth(1).stroke();

    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('Terms & Conditions:', ML, termY + 6)
      .text(companyTerms, ML, termY + 16, { width: 300 });

    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text(`For ${companyName.toUpperCase()}`, ML + 350, termY + 6, { width: contentWidth - 350, align: 'right' });
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('Authorized Signatory', ML + 350, termY + 36, { width: contentWidth - 350, align: 'right' });

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
