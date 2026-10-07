const httpStatus = require('http-status').default;
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const InfrastructureBill = require('../db/models/infrastructureBill.model');
const awsCostExplorerService = require('../services/awsCostExplorer.service');
const logger = require('../config/logger');

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

const createBill = async (req, res) => {
  try {
    const {
      month,
      awsAmount,
      awsUsdAmount,
      mongoDbAmount,
      exchangeRate,
      awsBreakdown,
      notes,
      isAutoSynced,
      paymentStatus,
      paidAt,
      paymentMethod,
      paymentRef,
    } = req.body;

    if (!month) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Month is required.' });
    }

    const existing = await InfrastructureBill.findOne({ month: month.trim() });
    if (existing) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'A billing record for this month already exists.' });
    }

    const bill = new InfrastructureBill({
      month: month.trim(),
      awsAmount: Number(awsAmount || 0),
      awsUsdAmount: Number(awsUsdAmount || 0),
      mongoDbAmount: Number(mongoDbAmount || 0),
      exchangeRate: Number(exchangeRate || 86.5),
      awsBreakdown: Array.isArray(awsBreakdown) ? awsBreakdown : [],
      isAutoSynced: Boolean(isAutoSynced),
      syncedAt: isAutoSynced ? new Date() : undefined,
      notes,
      paymentStatus: paymentStatus || 'UNPAID',
      paidAt: paymentStatus === 'PAID' ? (paidAt ? new Date(paidAt) : new Date()) : undefined,
      paymentMethod,
      paymentRef,
    });

    await bill.save();
    res.status(httpStatus.CREATED).json({ success: true, bill });
  } catch (error) {
    logger.error('createBill error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const getBills = async (req, res) => {
  try {
    const bills = await InfrastructureBill.find({}).sort({ createdAt: -1 });
    res.status(httpStatus.OK).json({ success: true, bills });
  } catch (error) {
    logger.error('getBills error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      month,
      awsAmount,
      awsUsdAmount,
      mongoDbAmount,
      exchangeRate,
      awsBreakdown,
      notes,
      isAutoSynced,
      paymentStatus,
      paidAt,
      paymentMethod,
      paymentRef,
    } = req.body;

    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    if (month && month.trim() !== bill.month) {
      const existing = await InfrastructureBill.findOne({ month: month.trim() });
      if (existing) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'A billing record for this month already exists.' });
      }
      bill.month = month.trim();
    }

    if (awsAmount !== undefined) bill.awsAmount = Number(awsAmount || 0);
    if (awsUsdAmount !== undefined) bill.awsUsdAmount = Number(awsUsdAmount || 0);
    if (mongoDbAmount !== undefined) bill.mongoDbAmount = Number(mongoDbAmount || 0);
    if (exchangeRate !== undefined) bill.exchangeRate = Number(exchangeRate || 86.5);
    if (awsBreakdown !== undefined) bill.awsBreakdown = Array.isArray(awsBreakdown) ? awsBreakdown : [];
    if (isAutoSynced !== undefined) bill.isAutoSynced = Boolean(isAutoSynced);
    if (isAutoSynced) bill.syncedAt = new Date();
    if (notes !== undefined) bill.notes = notes;

    if (paymentStatus !== undefined) {
      bill.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID') {
        bill.paidAt = paidAt ? new Date(paidAt) : (bill.paidAt || new Date());
      } else {
        bill.paidAt = null;
      }
    }
    if (paymentMethod !== undefined) bill.paymentMethod = paymentMethod;
    if (paymentRef !== undefined) bill.paymentRef = paymentRef;

    await bill.save();
    res.status(httpStatus.OK).json({ success: true, bill });
  } catch (error) {
    logger.error('updateBill error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus = 'PAID', paidAt, paymentMethod, paymentRef, notes } = req.body;

    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    bill.paymentStatus = paymentStatus;
    if (paymentStatus === 'PAID') {
      bill.paidAt = paidAt ? new Date(paidAt) : new Date();
    } else {
      bill.paidAt = null;
    }

    if (paymentMethod !== undefined) bill.paymentMethod = paymentMethod;
    if (paymentRef !== undefined) bill.paymentRef = paymentRef;
    if (notes !== undefined) bill.notes = notes;

    await bill.save();
    res.status(httpStatus.OK).json({
      success: true,
      message: `Bill marked as ${paymentStatus}.`,
      bill,
    });
  } catch (error) {
    logger.error('recordPayment error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    await bill.deleteOne();
    res.status(httpStatus.OK).json({ success: true, message: 'Billing record deleted successfully.' });
  } catch (error) {
    logger.error('deleteBill error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

/**
 * Live preview of AWS Cost Explorer without saving
 */
const getAwsLiveCost = async (req, res) => {
  try {
    const { startDate, endDate, exchangeRate } = req.query;
    const costData = await awsCostExplorerService.fetchAwsMonthlyCosts({
      startDate,
      endDate,
      exchangeRate: exchangeRate ? Number(exchangeRate) : undefined,
    });

    res.status(httpStatus.OK).json(costData);
  } catch (error) {
    logger.error('getAwsLiveCost error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

/**
 * Sync AWS costs directly into InfrastructureBill records in MongoDB.
 */
const syncAwsCosts = async (req, res) => {
  try {
    const { startDate, endDate, exchangeRate } = req.body || {};
    const costData = await awsCostExplorerService.fetchAwsMonthlyCosts({
      startDate,
      endDate,
      exchangeRate: exchangeRate ? Number(exchangeRate) : undefined,
    });

    if (!costData.success) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: costData.error,
        hint: costData.hint,
      });
    }

    const syncedBills = [];

    for (const item of costData.results || []) {
      let bill = await InfrastructureBill.findOne({ month: item.month });

      if (bill) {
        bill.awsAmount = item.totalInr;
        bill.awsUsdAmount = item.totalUsd;
        bill.exchangeRate = item.exchangeRate;
        bill.awsBreakdown = item.services;
        bill.isAutoSynced = true;
        bill.syncedAt = new Date();
        await bill.save();
      } else {
        bill = await InfrastructureBill.create({
          month: item.month,
          awsAmount: item.totalInr,
          awsUsdAmount: item.totalUsd,
          mongoDbAmount: 0,
          exchangeRate: item.exchangeRate,
          awsBreakdown: item.services,
          isAutoSynced: true,
          syncedAt: new Date(),
          notes: `Auto-synced from AWS Cost Explorer`,
        });
      }

      syncedBills.push(bill);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: `Successfully synced ${syncedBills.length} monthly bill(s) from AWS Cost Explorer.`,
      bills: syncedBills,
    });
  } catch (error) {
    logger.error('syncAwsCosts error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

/**
 * Generate professional PDF Invoice for an Infrastructure Bill
 */
const downloadInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
    });

    const safeMonth = (bill.month || 'Monthly_Bill').replace(/\s+/g, '_');
    const filename = `Infrastructure_Invoice_${safeMonth}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const PW = 595.28;
    const PH = 841.89;
    const M = 36;
    const CW = PW - M * 2; // ~523.28

    // Background Top Banner
    doc.rect(0, 0, PW, 75).fill('#0f172a'); // Deep slate

    // Accent strip
    doc.rect(0, 75, PW, 4).fill('#2563eb'); // Blue

    // Check for logo
    let logoPath = path.join(__dirname, 'Logo.png');
    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(__dirname, 'Logo_previous.png');
    }

    let hasLogo = false;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, M, 15, { width: 45, height: 45 });
        hasLogo = true;
      } catch (e) {
        hasLogo = false;
      }
    }

    const titleLeft = hasLogo ? M + 55 : M;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
      .text('ELITE EDITION', titleLeft, 20);
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
      .text('Cloud Infrastructure & Server Operations Invoice', titleLeft, 38);
    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
      .text('Surat, Gujarat, India • devops@eliteedition.in', titleLeft, 51);

    // Header Right Details
    const invoiceNo = `EE-INFRA-${bill._id.toString().slice(-6).toUpperCase()}`;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
      .text('INVOICE', M, 18, { width: CW, align: 'right' });
    doc.fillColor('#38bdf8').font('Helvetica-Bold').fontSize(9.5)
      .text(`Invoice #: ${invoiceNo}`, M, 35, { width: CW, align: 'right' });
    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(8.5)
      .text(`Date: ${new Date(bill.createdAt || Date.now()).toLocaleDateString('en-GB')}`, M, 48, { width: CW, align: 'right' });

    let curY = 95;

    // Billing Info Cards Row
    const cardWidth = (CW - 16) / 2;
    // Billed To Card
    doc.roundedRect(M, curY, cardWidth, 70, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8)
      .text('BILLED TO / ORGANISATION', M + 12, curY + 10);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11)
      .text('Elite Edition Enterprise ERP', M + 12, curY + 23);
    doc.fillColor('#334155').font('Helvetica').fontSize(8.5)
      .text('Cloud Server & Database Infrastructure Account', M + 12, curY + 38)
      .text(`Billing Month: ${bill.month}`, M + 12, curY + 51);

    // Payment Status Card
    const card2X = M + cardWidth + 16;
    const isPaid = bill.paymentStatus === 'PAID';
    const statusBg = isPaid ? '#dcfce7' : '#fee2e2';
    const statusBorder = isPaid ? '#86efac' : '#fca5a5';
    const statusColor = isPaid ? '#15803d' : '#b91c1c';

    doc.roundedRect(card2X, curY, cardWidth, 70, 6).fillAndStroke(statusBg, statusBorder);
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(8)
      .text('PAYMENT SETTLEMENT STATUS', card2X + 12, curY + 10);
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(14)
      .text(isPaid ? 'PAID / SETTLED' : 'PAYMENT DUE', card2X + 12, curY + 23);

    if (isPaid) {
      const paidDateStr = bill.paidAt ? new Date(bill.paidAt).toLocaleDateString('en-GB') : 'Verified';
      const refStr = bill.paymentRef ? ` • Ref: ${bill.paymentRef}` : '';
      doc.fillColor('#166534').font('Helvetica').fontSize(8)
        .text(`Paid on: ${paidDateStr}${refStr}`, card2X + 12, curY + 41)
        .text(`Mode: ${bill.paymentMethod || 'AWS Direct / Card'}`, card2X + 12, curY + 53);
    } else {
      doc.fillColor('#991b1b').font('Helvetica').fontSize(8)
        .text('Outstanding bill payable on AWS Billing Console', card2X + 12, curY + 41)
        .text('Click "Pay Bill" in ERP to settle directly', card2X + 12, curY + 53);
    }

    curY += 86;

    // Exchange Rate & Summary Banner
    doc.roundedRect(M, curY, CW, 28, 4).fillAndStroke('#eff6ff', '#bfdbfe');
    const rate = bill.exchangeRate || 86.5;
    doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(8.5)
      .text(`Applied Exchange Rate: 1 USD = ₹${rate.toFixed(2)} INR`, M + 12, curY + 9);
    const totalUsdVal = (bill.awsUsdAmount ? Number(bill.awsUsdAmount) : Number(bill.awsAmount || 0) / rate) + (Number(bill.mongoDbAmount || 0) / rate);
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(9)
      .text(`Total Bill Value: $${totalUsdVal.toFixed(2)} USD  /  ₹${Number(bill.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, M, curY + 9, { width: CW - 12, align: 'right' });

    curY += 40;

    // Table Header
    const colX = {
      sr: M,
      desc: M + 28,
      provider: M + 245,
      curr: M + 335,
      usd: M + 380,
      inr: M + 450,
    };

    doc.rect(M, curY, CW, 22).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    doc.text('#', colX.sr + 6, curY + 6);
    doc.text('Service & Resource Description', colX.desc, curY + 6);
    doc.text('Provider', colX.provider, curY + 6);
    doc.text('Currency', colX.curr, curY + 6);
    doc.text('USD ($)', colX.usd, curY + 6, { width: 60, align: 'right' });
    doc.text('INR (₹)', colX.inr, curY + 6, { width: CW - (colX.inr - M), align: 'right' });

    curY += 22;

    const rows = [];
    if (bill.awsBreakdown && bill.awsBreakdown.length > 0) {
      bill.awsBreakdown.forEach((s) => {
        rows.push({
          desc: s.service || 'AWS Service',
          provider: 'AWS Cloud',
          curr: 'USD',
          usd: Number(s.amountUsd || 0).toFixed(2),
          inr: Number(s.amountInr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        });
      });
    } else {
      const awsUsd = bill.awsUsdAmount ? bill.awsUsdAmount : (bill.awsAmount || 0) / rate;
      rows.push({
        desc: 'AWS Cloud Infrastructure (EC2 Compute, ALB, Storage, NAT)',
        provider: 'AWS Cloud',
        curr: 'USD',
        usd: Number(awsUsd || 0).toFixed(2),
        inr: Number(bill.awsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    }

    if (bill.mongoDbAmount > 0) {
      const mongoUsd = bill.mongoDbAmount / rate;
      rows.push({
        desc: 'MongoDB Atlas Database Cluster & Backup',
        provider: 'MongoDB Inc.',
        curr: 'INR',
        usd: Number(mongoUsd || 0).toFixed(2),
        inr: Number(bill.mongoDbAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    }

    // Render Rows
    rows.forEach((r, idx) => {
      // Check page overflow
      if (curY > PH - 140) {
        doc.addPage();
        curY = 40;
      }

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(M, curY, CW, 18).fill(rowBg);
      doc.rect(M, curY + 17.5, CW, 0.5).fill('#e2e8f0');

      doc.fillColor('#475569').font('Helvetica').fontSize(7.5);
      doc.text(`${idx + 1}`, colX.sr + 6, curY + 5);
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
      doc.text(r.desc, colX.desc, curY + 5, { width: 210, ellipsis: true });
      doc.fillColor('#64748b').font('Helvetica').fontSize(8);
      doc.text(r.provider, colX.provider, curY + 5);
      doc.text(r.curr, colX.curr, curY + 5);
      doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
      doc.text(`$${r.usd}`, colX.usd, curY + 5, { width: 60, align: 'right' });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
      doc.text(`₹${r.inr}`, colX.inr, curY + 5, { width: CW - (colX.inr - M), align: 'right' });

      curY += 18;
    });

    curY += 10;

    // Totals Section
    const totalsBoxW = 240;
    const totalsBoxX = M + CW - totalsBoxW;

    doc.roundedRect(totalsBoxX, curY, totalsBoxW, 64, 4).fillAndStroke('#f8fafc', '#cbd5e1');

    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
      .text('AWS Cloud Subtotal:', totalsBoxX + 12, curY + 8)
      .text(`₹${Number(bill.awsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsBoxX, curY + 8, { width: totalsBoxW - 12, align: 'right' });

    doc.fillColor('#64748b').font('Helvetica').fontSize(8)
      .text('MongoDB Database Subtotal:', totalsBoxX + 12, curY + 22)
      .text(`₹${Number(bill.mongoDbAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsBoxX, curY + 22, { width: totalsBoxW - 12, align: 'right' });

    doc.rect(totalsBoxX + 10, curY + 36, totalsBoxW - 20, 1).fill('#cbd5e1');

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10)
      .text('GRAND TOTAL (INR):', totalsBoxX + 12, curY + 44);
    doc.fillColor('#2563eb').font('Helvetica-Bold').fontSize(11)
      .text(`₹${Number(bill.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsBoxX, curY + 43, { width: totalsBoxW - 12, align: 'right' });

    // Amount in Words
    const wordsBoxW = CW - totalsBoxW - 16;
    doc.roundedRect(M, curY, wordsBoxW, 64, 4).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5)
      .text('AMOUNT IN WORDS', M + 10, curY + 8);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
      .text(numToWords(bill.totalAmount), M + 10, curY + 22, { width: wordsBoxW - 20 });
    if (bill.notes) {
      doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
        .text(`Notes: ${bill.notes}`, M + 10, curY + 44, { width: wordsBoxW - 20, ellipsis: true });
    }

    curY += 76;

    // Payment Settlement & Online Instructions
    doc.roundedRect(M, curY, CW, 52, 4).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5)
      .text('Payment Gateway & Cloud Billing Account Notice', M + 12, curY + 8);
    doc.fillColor('#475569').font('Helvetica').fontSize(8)
      .text('• AWS infrastructure payments can be settled directly in the AWS Payments Console at:', M + 12, curY + 22)
      .fillColor('#2563eb').text('https://us-east-1.console.aws.amazon.com/billing/home#/payments', M + 22, curY + 34);

    // Footer
    const footerY = PH - 35;
    doc.rect(M, footerY - 5, CW, 0.5).fill('#cbd5e1');
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
      .text('Elite Edition ERP • Computer-generated cloud infrastructure invoice • Valid without physical signature', M, footerY, { align: 'center' });

    doc.end();
  } catch (error) {
    logger.error('downloadInvoicePdf error: %o', error);
    if (!res.headersSent) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
    }
  }
};

module.exports = {
  createBill,
  getBills,
  updateBill,
  recordPayment,
  deleteBill,
  getAwsLiveCost,
  syncAwsCosts,
  downloadInvoicePdf,
};
