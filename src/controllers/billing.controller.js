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
    const START_SEQ = 1001;
    const lastInvoice = await BillingInvoice.findOne({}, 'invoiceSeq').sort({ invoiceSeq: -1 });

    const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? lastInvoice.invoiceSeq + 1 : START_SEQ;
    const prefix = 'EDP-INV-';
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
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};
    const companyName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyGstin = config.companyGstin || '24AAAFE1234F1Z5';
    const companyAddress = config.companyAddress || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone = config.companyPhone || '+91 98790 00000';
    const companyTerms = invoice.terms || config.companyTerms || 'Payment due within 15 days from invoice date.';

    const doc = new PDFDocument({ margin: 25, size: 'A4', autoFirstPage: true, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 30, MR = 30;
    const contentWidth = PW - ML - MR;
    const logoPath = path.join(__dirname, 'Logo.png');

    // Header Logo & Company Info
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, ML, 20, { width: 120 });
    }

    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold')
      .text(companyName.toUpperCase(), ML + 140, 20, { width: contentWidth - 140, align: 'right' });
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(companyAddress, ML + 140, 40, { width: contentWidth - 140, align: 'right' })
      .text(`GSTIN: ${companyGstin}  |  Phone: ${companyPhone}`, ML + 140, 52, { width: contentWidth - 140, align: 'right' });

    doc.moveTo(ML, 68).lineTo(PW - MR, 68).strokeColor('#7c3aed').lineWidth(1.5).stroke();

    // Tax Invoice Badge & Metadata Box
    doc.rect(ML, 76, contentWidth, 54).fill('#f8fafc').stroke('#e2e8f0');

    doc.fillColor('#6b21a8').fontSize(14).font('Helvetica-Bold')
      .text('TAX INVOICE', ML + 12, 86);
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(`Invoice No: ${invoice.invoiceNo}`, ML + 12, 106);

    const invDateStr = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : '—';
    const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—';

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(`Date: ${invDateStr}`, ML + 300, 86, { width: contentWidth - 300, align: 'right' })
      .text(`Due Date: ${dueDateStr}`, ML + 300, 98, { width: contentWidth - 300, align: 'right' })
      .text(`Status: ${invoice.paymentStatus}`, ML + 300, 110, { width: contentWidth - 300, align: 'right' });

    // Customer Details Box
    doc.rect(ML, 138, contentWidth, 60).fill('#f1f5f9').stroke('#cbd5e1');
    const cust = invoice.customer || {};

    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
      .text('BILLED TO (CUSTOMER):', ML + 10, 145);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
      .text(`${cust.businessName ? cust.businessName + ' (' + cust.name + ')' : cust.name || '—'}`, ML + 10, 159)
      .text(`GSTIN: ${cust.gstin || 'N/A'}  |  Phone: ${cust.phone || '—'}`, ML + 10, 171)
      .text(`Address: ${cust.billingAddress || '—'}`, ML + 10, 183, { width: contentWidth - 20, lineBreak: false });

    // Items Table Header
    let tableY = 208;
    doc.rect(ML, tableY, contentWidth, 20).fill('#6b21a8');

    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('#', ML + 6, tableY + 5, { width: 20 });
    doc.text('ITEM / DESCRIPTION', ML + 30, tableY + 5, { width: 180 });
    doc.text('HSN', ML + 215, tableY + 5, { width: 45, align: 'center' });
    doc.text('QTY', ML + 265, tableY + 5, { width: 45, align: 'center' });
    doc.text('RATE (₹)', ML + 315, tableY + 5, { width: 60, align: 'right' });
    doc.text('GST %', ML + 380, tableY + 5, { width: 45, align: 'center' });
    doc.text('AMOUNT (₹)', ML + 430, tableY + 5, { width: contentWidth - 436, align: 'right' });

    tableY += 20;

    // Items Rows
    const items = invoice.items || [];
    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(ML, tableY, contentWidth, 22).fill(rowBg).stroke('#e2e8f0');

      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(String(idx + 1), ML + 6, tableY + 6, { width: 20 });
      doc.text(item.itemName || '—', ML + 30, tableY + 6, { width: 180, lineBreak: false, ellipsis: true });
      doc.text(item.hsnCode || '5407', ML + 215, tableY + 6, { width: 45, align: 'center' });
      doc.text(`${item.qty} ${item.unit || ''}`, ML + 265, tableY + 6, { width: 45, align: 'center' });
      doc.text(Number(item.unitPrice || 0).toFixed(2), ML + 315, tableY + 6, { width: 60, align: 'right' });
      doc.text(`${item.taxRate || 18}%`, ML + 380, tableY + 6, { width: 45, align: 'center' });
      doc.text(Number(item.totalAmount || 0).toFixed(2), ML + 430, tableY + 6, { width: contentWidth - 436, align: 'right' });

      tableY += 22;
    });

    // Summary Box (Subtotal, Tax, Grand Total)
    tableY += 10;

    const summaryBoxX = ML + contentWidth - 220;
    doc.rect(summaryBoxX, tableY, 220, 95).fill('#f8fafc').stroke('#cbd5e1');

    let sumY = tableY + 8;
    doc.fillColor('#475569').fontSize(8).font('Helvetica');

    doc.text('Subtotal:', summaryBoxX + 10, sumY);
    doc.text(`₹ ${Number(invoice.subtotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });
    sumY += 14;

    if (invoice.discountTotal > 0) {
      doc.text('Discount:', summaryBoxX + 10, sumY);
      doc.text(`- ₹ ${Number(invoice.discountTotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });
      sumY += 14;
    }

    if (invoice.taxType === 'IGST') {
      doc.text('IGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`₹ ${Number(invoice.igstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });
      sumY += 14;
    } else {
      doc.text('CGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`₹ ${Number(invoice.cgstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });
      sumY += 14;

      doc.text('SGST Amount:', summaryBoxX + 10, sumY);
      doc.text(`₹ ${Number(invoice.sgstAmount || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });
      sumY += 14;
    }

    doc.moveTo(summaryBoxX, sumY).lineTo(PW - MR, sumY).strokeColor('#cbd5e1').lineWidth(1).stroke();
    sumY += 4;

    doc.fillColor('#6b21a8').fontSize(9.5).font('Helvetica-Bold');
    doc.text('Grand Total:', summaryBoxX + 10, sumY);
    doc.text(`₹ ${Number(invoice.grandTotal || 0).toFixed(2)}`, summaryBoxX + 10, sumY, { width: 200, align: 'right' });

    // Amount in Words
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text('Amount in Words:', ML, tableY + 5);
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(numToWords(invoice.grandTotal), ML, tableY + 18, { width: contentWidth - 230 });

    // Payment Details / Bank Details Box
    tableY += 105;
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
      .text('PAYMENT & BANK DETAILS:', ML, tableY);
    tableY += 12;

    let payDetailsStr = `Paid Amount: ₹ ${Number(invoice.paidAmount || 0).toFixed(2)}   |   Balance Due: ₹ ${Number(invoice.balanceDue || 0).toFixed(2)}`;
    if (config.companyBankName || config.companyAccountNo) {
      payDetailsStr += `\nBank: ${config.companyBankName || 'N/A'}  |  A/C No: ${config.companyAccountNo || 'N/A'}  |  IFSC: ${config.companyIfscCode || 'N/A'}`;
    }

    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(payDetailsStr, ML, tableY, { width: contentWidth });

    // Terms & Authorized Signatory Footer
    tableY += 35;
    doc.moveTo(ML, tableY).lineTo(PW - MR, tableY).strokeColor('#e2e8f0').lineWidth(1).stroke();
    tableY += 10;

    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('Terms & Conditions:', ML, tableY)
      .text(companyTerms, ML, tableY + 10, { width: 300 });

    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text(`For ${companyName.toUpperCase()}`, ML + 350, tableY, { width: contentWidth - 350, align: 'right' });
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('Authorized Signatory', ML + 350, tableY + 35, { width: contentWidth - 350, align: 'right' });
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text('Authorized Signatory', ML + 350, tableY + 35, { width: contentWidth - 350, align: 'right' });

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
