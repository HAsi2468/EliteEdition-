const mongoose = require('mongoose');
const db = require('../db/models');
const DeliveryChallan = db.DeliveryChallan;
const BillingInvoice = db.BillingInvoice;
const BillingCustomer = db.BillingCustomer;
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');

// Helper to determine prefix based on companyEntity
const getCompanyPrefix = (entity = 'Sobise') => {
  const norm = String(entity || '').trim().toLowerCase();
  if (norm.includes('ethno') || norm === 'ew') return 'EWC-';
  if (norm.includes('sobise')) return 'SO-';
  if (norm.includes('fabtex')) return 'EF-';
  if (norm.includes('edition')) return 'EE-';
  return 'DC-';
};

// ── GET /delivery-challans/next-no ────────────────────────────────────────────
const getNextChallanNo = async (req, res) => {
  try {
    const companyEntity = req.query.companyEntity || 'Sobise';
    const prefix = getCompanyPrefix(companyEntity);
    const isEthno = prefix === 'EWC-';

    // Find the latest challan with this prefix or companyEntity
    const last = await DeliveryChallan.findOne({
      $or: [
        { companyEntity },
        { challanNo: { $regex: `^${prefix}`, $options: 'i' } }
      ]
    })
      .sort({ challanSeq: -1, createdAt: -1 })
      .lean();

    let nextSeq = isEthno ? 1 : 1000;
    if (last && last.challanSeq) {
      nextSeq = Math.max(last.challanSeq + 1, isEthno ? 1 : 1000);
    } else if (last && last.challanNo) {
      const match = String(last.challanNo).match(/\d+/);
      if (match) {
        nextSeq = Math.max(parseInt(match[0], 10) + 1, isEthno ? 1 : 1000);
      }
    }

    const nextNo = isEthno ? `${prefix}${String(nextSeq).padStart(2, '0')}` : `${prefix}${nextSeq}`;
    res.json({ success: true, nextNo, nextSeq, prefix });
  } catch (error) {
    logger.error('deliveryChallan.getNextChallanNo error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /delivery-challans ────────────────────────────────────────────────────
const getChallans = async (req, res) => {
  try {
    const { companyEntity, status, search, startDate, endDate } = req.query;
    const query = {};

    if (companyEntity) {
      query.companyEntity = companyEntity;
    }

    if (status && status !== 'ALL') {
      if (status === 'PENDING_INVOICE') {
        query.invoiced = false;
        query.status = { $ne: 'CANCELLED' };
      } else {
        query.status = status;
      }
    }

    if (startDate || endDate) {
      query.challanDate = {};
      if (startDate) query.challanDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.challanDate.$lte = end;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      const sRegex = new RegExp(term, 'i');
      query.$or = [
        { challanNo: sRegex },
        { 'customer.name': sRegex },
        { 'customer.businessName': sRegex },
        { 'customer.phone': sRegex },
        { 'dispatchDetails.vehicleNo': sRegex },
        { 'dispatchDetails.transporter': sRegex },
        { 'items.itemName': sRegex }
      ];
    }

    const challans = await DeliveryChallan.find(query)
      .sort({ challanDate: -1, challanSeq: -1 })
      .lean();

    // Compute stats
    const allForCompany = await DeliveryChallan.find(companyEntity ? { companyEntity } : {}).lean();
    let totalChallans = allForCompany.length;
    let totalDelivered = 0;
    let pendingInvoice = 0;
    let invoicedCount = 0;
    let totalDispatchedQty = 0;

    for (const ch of allForCompany) {
      if (ch.status === 'DELIVERED') totalDelivered++;
      if (ch.invoiced || ch.status === 'INVOICED') invoicedCount++;
      if (!ch.invoiced && ch.status !== 'CANCELLED') pendingInvoice++;
      totalDispatchedQty += (ch.totalQty || 0);
    }

    res.json({
      success: true,
      data: challans,
      stats: {
        totalChallans,
        totalDelivered,
        pendingInvoice,
        invoicedCount,
        totalDispatchedQty: parseFloat(totalDispatchedQty.toFixed(2))
      }
    });
  } catch (error) {
    logger.error('deliveryChallan.getChallans error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /delivery-challans/:id ────────────────────────────────────────────────
const getChallanById = async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Delivery Challan not found' });
    }
    res.json({ success: true, data: challan });
  } catch (error) {
    logger.error('deliveryChallan.getChallanById error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Helper to calculate item & document totals ───────────────────────────────
const calculateChallanTotals = (data) => {
  let subtotal = 0;
  let taxTotal = 0;
  let totalQty = 0;

  const items = (data.items || []).map((it) => {
    const qty = parseFloat(it.qty) || 0;
    const unitPrice = parseFloat(it.unitPrice) || 0;
    const taxRate = parseFloat(it.taxRate) || 0;
    const lineSubtotal = parseFloat((qty * unitPrice).toFixed(2));
    const taxAmount = parseFloat(((lineSubtotal * taxRate) / 100).toFixed(2));
    const totalAmount = parseFloat((lineSubtotal + taxAmount).toFixed(2));

    subtotal += lineSubtotal;
    taxTotal += taxAmount;
    totalQty += qty;

    return {
      ...it,
      qty,
      unitPrice,
      taxRate,
      taxAmount,
      totalAmount
    };
  });

  const grandTotal = parseFloat((subtotal + taxTotal).toFixed(2));

  return {
    items,
    totalQty: parseFloat(totalQty.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxTotal: parseFloat(taxTotal.toFixed(2)),
    grandTotal
  };
};

// ── POST /delivery-challans ───────────────────────────────────────────────────
const createChallan = async (req, res) => {
  try {
    const body = { ...req.body };
    const companyEntity = body.companyEntity || 'Sobise';
    const prefix = getCompanyPrefix(companyEntity);
    const isEthno = prefix === 'EWC-';

    // Auto-generate sequential challan number if not explicitly set
    if (!body.challanNo || !body.challanSeq) {
      const last = await DeliveryChallan.findOne({
        $or: [
          { companyEntity },
          { challanNo: { $regex: `^${prefix}`, $options: 'i' } }
        ]
      })
        .sort({ challanSeq: -1, createdAt: -1 })
        .lean();

      let nextSeq = isEthno ? 1 : 1000;
      if (last && last.challanSeq) {
        nextSeq = Math.max(last.challanSeq + 1, isEthno ? 1 : 1000);
      } else if (last && last.challanNo) {
        const match = String(last.challanNo).match(/\d+/);
        if (match) nextSeq = Math.max(parseInt(match[0], 10) + 1, isEthno ? 1 : 1000);
      }

      body.challanSeq = nextSeq;
      body.challanNo = isEthno ? `${prefix}${String(nextSeq).padStart(2, '0')}` : `${prefix}${nextSeq}`;
    } else {
      const match = String(body.challanNo).match(/\d+/);
      body.challanSeq = match ? parseInt(match[0], 10) : (isEthno ? 1 : 1000);
    }

    body.challanPrefix = prefix;

    // Calculate totals
    const computed = calculateChallanTotals(body);
    Object.assign(body, computed);

    if (!body.status) {
      body.status = 'PENDING';
    }

    const doc = new DeliveryChallan(body);
    await doc.save();

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error('deliveryChallan.createChallan error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── PUT /delivery-challans/:id ────────────────────────────────────────────────
const updateChallan = async (req, res) => {
  try {
    const body = { ...req.body };
    const computed = calculateChallanTotals(body);
    Object.assign(body, computed);

    const updated = await DeliveryChallan.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Delivery Challan not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('deliveryChallan.updateChallan error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /delivery-challans/:id ─────────────────────────────────────────────
const deleteChallan = async (req, res) => {
  try {
    const doc = await DeliveryChallan.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Delivery Challan not found' });
    }

    if (doc.invoiced) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete Challan ${doc.challanNo} because it has already been converted to Tax Invoice ${doc.invoiceNo}.`
      });
    }

    await DeliveryChallan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Challan ${doc.challanNo} deleted successfully.` });
  } catch (error) {
    logger.error('deliveryChallan.deleteChallan error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /delivery-challans/:id/convert-to-invoice ────────────────────────────
// 1-Click Convert Delivery Challan directly to Billing Tax Invoice
const convertToInvoice = async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id);
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Delivery Challan not found' });
    }

    if (challan.invoiced && challan.invoiceId) {
      const existingInv = await BillingInvoice.findById(challan.invoiceId);
      if (existingInv) {
        return res.json({
          success: true,
          message: `Already converted to Invoice ${existingInv.invoiceNo}`,
          data: existingInv,
          alreadyInvoiced: true
        });
      }
    }

    const companyEntity = challan.companyEntity || 'Sobise';

    // Generate Next Sequential Invoice No for the company
    let invPrefix = 'SO/26-27/';
    if (companyEntity === 'Elite Edition') invPrefix = 'EE/26-27/';
    else if (companyEntity === 'Elite Fabtex') invPrefix = 'EF/26-27/';
    else if (companyEntity === 'Elite Digital Print' || companyEntity === 'Elite Digital Prints') invPrefix = 'EDP/26-27/';

    const lastInv = await BillingInvoice.findOne({
      companyEntity,
      invoiceNo: { $regex: `^${invPrefix.replace('/', '\\/')}`, $options: 'i' }
    })
      .sort({ invoiceSeq: -1, createdAt: -1 })
      .lean();

    let nextInvSeq = lastInv && lastInv.invoiceSeq ? lastInv.invoiceSeq + 1 : 1;
    const nextInvNo = `${invPrefix}${nextInvSeq}`;

    // Map items from Challan to Invoice line items
    const invoiceItems = (challan.items || []).map((it) => ({
      itemName: it.itemName,
      description: it.description || '',
      hsnCode: it.hsnCode || '6204',
      qty: it.qty || 1,
      unit: it.unit || 'Pcs',
      unitPrice: it.unitPrice || 0,
      taxRate: it.taxRate || 5,
      taxAmount: it.taxAmount || 0,
      totalAmount: it.totalAmount || 0,
      ourChallanNo: challan.challanNo,
      partyChallan: challan.challanNo,
      challanId: String(challan._id),
      jobNo: it.jobNo || challan.jobNo || '',
      designNo: it.designNo || challan.designNo || '',
      fabric: it.fabric || it.fabricName || challan.fabric || '',
      lotNo: it.lotNo || challan.lotNo || '',
      imageUrl: it.imageUrl || it.image || it.designImage || challan.designImage || challan.imageUrl || ''
    }));

    // Tax computation (CGST+SGST vs IGST based on State)
    const isInterstate = (challan.customer?.stateCode && String(challan.customer.stateCode) !== '24') ||
      (challan.customer?.state && challan.customer.state.toLowerCase() !== 'gujarat');

    let subtotal = challan.subtotal || 0;
    let totalTax = challan.taxTotal || 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isInterstate) {
      igstAmount = totalTax;
    } else {
      cgstAmount = parseFloat((totalTax / 2).toFixed(2));
      sgstAmount = parseFloat((totalTax - cgstAmount).toFixed(2));
    }

    const grandTotal = parseFloat((subtotal + totalTax).toFixed(2));

    const invoicePayload = {
      companyEntity,
      invoiceNo: nextInvNo,
      invoicePrefix: invPrefix,
      invoiceSeq: nextInvSeq,
      ourChallanNo: challan.challanNo,
      linkedChallanNos: [challan.challanNo],
      linkedChallanIds: [String(challan._id)],
      invoiceDate: new Date(),
      customer: challan.customer,
      items: invoiceItems,
      subtotal,
      taxType: isInterstate ? 'IGST' : 'CGST_SGST',
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      roundOff: 0,
      grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      paymentStatus: 'UNPAID',
      invoiceStatus: 'FINAL',
      terms: challan.terms || '1. Goods once sold will not be taken back.'
    };

    const newInvoice = new BillingInvoice(invoicePayload);
    await newInvoice.save();

    // Mark Challan as INVOICED
    challan.invoiced = true;
    challan.status = 'INVOICED';
    challan.invoiceId = newInvoice._id;
    challan.invoiceNo = newInvoice.invoiceNo;
    challan.invoicedAt = new Date();
    await challan.save();

    res.status(201).json({
      success: true,
      message: `Successfully converted Challan ${challan.challanNo} to Invoice ${newInvoice.invoiceNo}`,
      data: newInvoice,
      challan
    });
  } catch (error) {
    logger.error('deliveryChallan.convertToInvoice error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /delivery-challans/:id/pdf ────────────────────────────────────────────
// Generate printable vector PDF for Delivery Challan
const downloadChallanPdf = async (req, res) => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(404).send('Delivery Challan not found');
    }

    const doc = new PDFDocument({ margin: 36, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Challan_${challan.challanNo}.pdf"`);

    doc.pipe(res);

    // Color definitions
    const primaryColor = '#e11d48'; // Sobise rose
    const textColor = '#0f172a';
    const mutedColor = '#64748b';

    // Header Title
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text(challan.companyEntity || 'SOBISE', 36, 36);
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text('Corporate & Fashion Apparel Delivery Division', 36, 60);

    // Document Badge
    doc.roundedRect(420, 36, 140, 26, 4).fillAndStroke(`${primaryColor}15`, primaryColor);
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('DELIVERY CHALLAN', 432, 44);

    doc.moveDown(2);

    // Challan Meta Box
    const metaY = 82;
    doc.rect(36, metaY, 523, 78).stroke('#e2e8f0');

    // Left Column: Customer details
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('CONSIGNEE / DELIVER TO:', 46, metaY + 8);
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(challan.customer?.name || 'Party Name', 46, metaY + 22);
    if (challan.customer?.businessName) {
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica').text(challan.customer.businessName, 46, metaY + 34);
    }
    const custAddr = challan.customer?.shippingAddress || challan.customer?.billingAddress || '';
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text(custAddr.slice(0, 50), 46, metaY + 46);
    if (challan.customer?.gstin) {
      doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${challan.customer.gstin}`, 46, metaY + 57);
    }

    // Right Column: Challan & Dispatch Details
    const rightX = 330;
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Challan No:', rightX, metaY + 8);
    doc.fillColor(textColor).fontSize(9.5).font('Helvetica-Bold').text(challan.challanNo, rightX + 65, metaY + 8);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Date:', rightX, metaY + 21);
    const dt = challan.challanDate ? new Date(challan.challanDate).toLocaleDateString('en-IN') : '-';
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica').text(dt, rightX + 65, metaY + 21);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Vehicle No:', rightX, metaY + 34);
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica-Bold').text(challan.dispatchDetails?.vehicleNo || 'N/A', rightX + 65, metaY + 34);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Transporter:', rightX, metaY + 47);
    doc.fillColor(textColor).fontSize(8).font('Helvetica').text(challan.dispatchDetails?.transporter || 'Direct', rightX + 65, metaY + 47);

    const extraDispatch = [
      challan.dispatchDetails?.lrNo ? `LR: ${challan.dispatchDetails.lrNo}` : '',
      challan.dispatchDetails?.eWayBillNo ? `E-Way: ${challan.dispatchDetails.eWayBillNo}` : ''
    ].filter(Boolean).join(' | ');

    if (extraDispatch) {
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(extraDispatch, rightX, metaY + 61);
    }

    // Line Items Table Header
    const tableY = metaY + 90;
    doc.rect(36, tableY, 523, 22).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica-Bold');
    doc.text('#', 44, tableY + 6);
    doc.text('Item Description', 70, tableY + 6);
    doc.text('HSN Code', 260, tableY + 6);
    doc.text('Qty', 330, tableY + 6, { width: 40, align: 'right' });
    doc.text('Unit', 380, tableY + 6);
    doc.text('Rate (₹)', 420, tableY + 6, { width: 55, align: 'right' });
    doc.text('Total (₹)', 485, tableY + 6, { width: 65, align: 'right' });

    let rowY = tableY + 22;
    (challan.items || []).forEach((it, idx) => {
      if (rowY > 700) {
        doc.addPage();
        rowY = 40;
      }
      doc.rect(36, rowY, 523, 20).stroke('#f1f5f9');
      doc.fillColor(textColor).fontSize(8.5).font('Helvetica');
      doc.text(String(idx + 1), 44, rowY + 5);
      doc.text(it.itemName || '', 70, rowY + 5, { width: 180, ellipsis: true });
      doc.text(it.hsnCode || '-', 260, rowY + 5);
      doc.text(Number(it.qty || 0).toLocaleString('en-IN'), 330, rowY + 5, { width: 40, align: 'right' });
      doc.text(it.unit || 'Pcs', 380, rowY + 5);
      doc.text(Number(it.unitPrice || 0).toFixed(2), 420, rowY + 5, { width: 55, align: 'right' });
      doc.text(Number(it.totalAmount || 0).toFixed(2), 485, rowY + 5, { width: 65, align: 'right' });
      rowY += 20;
    });

    // Summary Box
    const sumY = Math.max(rowY + 10, 480);
    doc.rect(36, sumY, 320, 75).stroke('#e2e8f0');
    doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text('TERMS & CONDITIONS:', 44, sumY + 8);
    doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(challan.terms || '1. Goods delivered in good order.\n2. Receiver acknowledgment required.', 44, sumY + 22, { width: 300 });

    // Totals Box
    doc.rect(370, sumY, 189, 75).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor(textColor).fontSize(8.5).font('Helvetica');
    doc.text('Total Quantity:', 380, sumY + 12);
    doc.font('Helvetica-Bold').text(`${challan.totalQty || 0} Pcs/Mtr`, 480, sumY + 12, { align: 'right', width: 70 });

    doc.font('Helvetica').text('Subtotal:', 380, sumY + 28);
    doc.font('Helvetica-Bold').text(`₹ ${(challan.subtotal || 0).toFixed(2)}`, 480, sumY + 28, { align: 'right', width: 70 });

    doc.font('Helvetica').text('Taxes (GST):', 380, sumY + 44);
    doc.font('Helvetica-Bold').text(`₹ ${(challan.taxTotal || 0).toFixed(2)}`, 480, sumY + 44, { align: 'right', width: 70 });

    doc.rect(370, sumY + 58, 189, 17).fill(primaryColor);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('Grand Total:', 380, sumY + 62);
    doc.text(`₹ ${(challan.grandTotal || 0).toFixed(2)}`, 480, sumY + 62, { align: 'right', width: 70 });

    // Signatures
    const sigY = sumY + 110;
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
    doc.text("Receiver's Signature & Stamp", 50, sigY);
    doc.text(`For ${challan.companyEntity || 'SOBISE'}`, 430, sigY);
    doc.text('Authorized Signatory', 430, sigY + 30);

    doc.end();
  } catch (error) {
    logger.error('deliveryChallan.downloadChallanPdf error: %o', error);
    res.status(500).send('Error generating PDF');
  }
};

module.exports = {
  getNextChallanNo,
  getChallans,
  getChallanById,
  createChallan,
  updateChallan,
  deleteChallan,
  convertToInvoice,
  downloadChallanPdf
};
