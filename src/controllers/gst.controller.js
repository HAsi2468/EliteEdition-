const ExcelJS = require('exceljs');
const db = require('../db/models');
const logger = require('../config/logger');

// Standard Indian State Codes
const STATE_NAMES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '19': 'West Bengal',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh'
};

const HSN_STANDARD_DESCRIPTIONS = {
  '9988': 'Textile Job Work / Manufacturing Services on Inputs Owned by Others',
  '998821': 'Textile Job Work / Digital Printing, Dyeing & Bleaching Services',
  '998822': 'Knitting, Weaving and Stitching Job Work Services',
  '998829': 'Other Manufacturing Services on Textile Inputs',
  '9983': 'Design, Graphic and Digital Artwork Services',
  '9965': 'Goods Transport Agency (GTA) Road Freight Services',
  '9967': 'Auxiliary Transport & Cargo Handling Services',
  '5407': 'Woven Fabrics of Synthetic Filament Yarn (Polyester, Nylon)',
  '5408': 'Woven Fabrics of Artificial Filament Yarn',
  '5208': 'Woven Fabrics of Cotton (Powerloom / Mill Made)',
  '5209': 'Woven Fabrics of Cotton (Heavy Weight)',
  '5512': 'Woven Fabrics of Synthetic Staple Fibres',
  '5513': 'Woven Fabrics of Synthetic Staple Fibres (Mixed with Cotton)',
  '5514': 'Woven Fabrics of Synthetic Staple Fibres (Heavy Weight)',
  '5515': 'Other Woven Fabrics of Synthetic Staple Fibres',
  '5516': 'Woven Fabrics of Artificial Staple Fibres',
  '6001': 'Pile Fabrics (Including Terry Towelling)',
  '6006': 'Other Knitted or Crocheted Fabrics',
  '6203': 'Mens / Boys Suits, Ensembles, Trousers',
  '6204': 'Womens / Girls Suits, Ensembles, Dresses',
  '6302': 'Bed Linen, Table Linen, Toilet Linen and Kitchen Linen',
  '6307': 'Other Made Up Textile Articles'
};

function normalizeUqc(unit, hsnCode) {
  const u = String(unit || '').trim().toLowerCase();
  const hsn = String(hsnCode || '').trim();
  const isService = hsn.startsWith('99');

  if (/meter|mtr/i.test(u)) return 'MTR';
  if (/kg|kilo/i.test(u)) return 'KGS';
  if (/pc|piece/i.test(u)) return 'PCS';
  if (/no|number|nos/i.test(u)) return 'NOS';
  if (/roll/i.test(u)) return 'ROL';
  if (/yard|yd/i.test(u)) return 'YDS';
  if (/sqm|sq\.mt|sq\s*mtr/i.test(u)) return 'SQM';
  if (/sqf|sq\.ft/i.test(u)) return 'SQF';
  if (isService && (!u || /na|none|oth|other|service|job/i.test(u))) return 'OTH';
  if (u.length === 3 && /^[A-Z]{3}$/i.test(u)) return u.toUpperCase();
  return isService ? 'OTH' : 'MTR';
}

function resolveHsnDescription(hsnCode, rawDesc, rawItemName) {
  const code = String(hsnCode || '').trim();
  if (HSN_STANDARD_DESCRIPTIONS[code]) return HSN_STANDARD_DESCRIPTIONS[code];
  const prefix4 = code.substring(0, 4);
  if (HSN_STANDARD_DESCRIPTIONS[prefix4]) return HSN_STANDARD_DESCRIPTIONS[prefix4];
  if (rawDesc && rawDesc.trim().length > 2) return rawDesc.trim();
  if (rawItemName && rawItemName.trim().length > 2) return rawItemName.trim();
  if (code.startsWith('99')) return 'Textile Job Work / Processing Services';
  return 'Textile Fabrics / Goods';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GSTR-1 TABLE 12 OUTWARD AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────
exports.getTable12Aggregates = async (req, res) => {
  try {
    const { companyEntity, startDate, endDate, turnoverTier = 'LE_5CR' } = req.query;

    const query = { invoiceStatus: { $ne: 'CANCELLED' } };
    if (companyEntity && companyEntity !== 'ALL') {
      query.companyEntity = new RegExp(companyEntity.trim(), 'i');
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = eDate;
      }
    }

    const invoices = await db.BillingInvoice.find(query).lean();
    const groups = {};

    invoices.forEach((inv) => {
      const isInterState = inv.taxType === 'IGST' ||
        (inv.customer?.stateCode && String(inv.customer.stateCode).trim() !== '24') ||
        (inv.customer?.state && !inv.customer.state.toLowerCase().includes('gujarat')) ||
        (Number(inv.igstAmount || 0) > 0);

      const items = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : [{
            itemName: 'Textile Digital Printing / Supply',
            hsnCode: '998821',
            qty: 0,
            unit: 'OTH',
            totalAmount: inv.taxableAmount || inv.subtotal || 0,
            taxRate: 5
          }];

      items.forEach((it) => {
        const rawHsn = it.hsnCode || '998821';
        const hsn = String(rawHsn).trim() || 'UNMAPPED';
        const uqc = normalizeUqc(it.unit, hsn);
        const taxRate = Number(it.taxRate != null ? it.taxRate : 5);
        const isService = hsn.startsWith('99');

        // Total quantity: 0 for service/SAC without physical measurement
        const qty = isService && (/oth/i.test(uqc) || Number(it.qty) <= 0) ? 0 : Number(it.qty || 0);
        const taxable = Number(
          it.totalAmount != null
            ? it.totalAmount
            : (Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discountAmt || 0))
        ) || 0;

        let igst = 0;
        let cgst = 0;
        let sgst = 0;
        const cess = 0;

        if (isInterState) {
          igst = taxable * (taxRate / 100);
        } else {
          cgst = taxable * (taxRate / 2 / 100);
          sgst = taxable * (taxRate / 2 / 100);
        }

        const totalVal = taxable + igst + cgst + sgst + cess;
        const groupKey = `${hsn}_${uqc}_${taxRate}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            hsn,
            description: resolveHsnDescription(hsn, it.description, it.itemName),
            uqc,
            taxRate,
            isService,
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessAmount: 0,
            itemsCount: 0
          };
        }

        const g = groups[groupKey];
        g.totalQuantity += qty;
        g.taxableValue += taxable;
        g.igstAmount += igst;
        g.cgstAmount += cgst;
        g.sgstAmount += sgst;
        g.cessAmount += cess;
        g.totalValue += totalVal;
        g.itemsCount += 1;
      });
    });

    const rows = Object.values(groups).map((r) => ({
      ...r,
      totalQuantity: Number(r.totalQuantity.toFixed(2)),
      totalValue: Number(r.totalValue.toFixed(2)),
      taxableValue: Number(r.taxableValue.toFixed(2)),
      igstAmount: Number(r.igstAmount.toFixed(2)),
      cgstAmount: Number(r.cgstAmount.toFixed(2)),
      sgstAmount: Number(r.sgstAmount.toFixed(2)),
      cessAmount: Number(r.cessAmount.toFixed(2))
    })).sort((a, b) => a.hsn.localeCompare(b.hsn));

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalQuantity += r.totalQuantity;
        acc.totalValue += r.totalValue;
        acc.taxableValue += r.taxableValue;
        acc.igstAmount += r.igstAmount;
        acc.cgstAmount += r.cgstAmount;
        acc.sgstAmount += r.sgstAmount;
        acc.cessAmount += r.cessAmount;
        return acc;
      },
      { totalQuantity: 0, totalValue: 0, taxableValue: 0, igstAmount: 0, cgstAmount: 0, sgstAmount: 0, cessAmount: 0 }
    );

    res.json({
      success: true,
      data: rows,
      totals: {
        totalQuantity: Number(totals.totalQuantity.toFixed(2)),
        totalValue: Number(totals.totalValue.toFixed(2)),
        taxableValue: Number(totals.taxableValue.toFixed(2)),
        igstAmount: Number(totals.igstAmount.toFixed(2)),
        cgstAmount: Number(totals.cgstAmount.toFixed(2)),
        sgstAmount: Number(totals.sgstAmount.toFixed(2)),
        cessAmount: Number(totals.cessAmount.toFixed(2))
      },
      totalInvoices: invoices.length
    });
  } catch (err) {
    logger.error('Error in getTable12Aggregates: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 1-Click Excel Export (GST Offline Tool Compliant)
exports.exportTable12Excel = async (req, res) => {
  try {
    const { companyEntity, startDate, endDate, gstin = '24AANFE0044M1ZG' } = req.query;

    const query = { invoiceStatus: { $ne: 'CANCELLED' } };
    if (companyEntity && companyEntity !== 'ALL') {
      query.companyEntity = new RegExp(companyEntity.trim(), 'i');
    }
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = eDate;
      }
    }

    const invoices = await db.BillingInvoice.find(query).lean();
    const groups = {};

    invoices.forEach((inv) => {
      const isInterState = inv.taxType === 'IGST' ||
        (inv.customer?.stateCode && String(inv.customer.stateCode).trim() !== '24') ||
        (inv.customer?.state && !inv.customer.state.toLowerCase().includes('gujarat')) ||
        (Number(inv.igstAmount || 0) > 0);

      const items = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : [{
            itemName: 'Textile Digital Printing / Supply',
            hsnCode: '998821',
            qty: 0,
            unit: 'OTH',
            totalAmount: inv.taxableAmount || inv.subtotal || 0,
            taxRate: 5
          }];

      items.forEach((it) => {
        const rawHsn = it.hsnCode || '998821';
        const hsn = String(rawHsn).trim() || 'UNMAPPED';
        const uqc = normalizeUqc(it.unit, hsn);
        const taxRate = Number(it.taxRate != null ? it.taxRate : 5);
        const isService = hsn.startsWith('99');
        const qty = isService && (/oth/i.test(uqc) || Number(it.qty) <= 0) ? 0 : Number(it.qty || 0);
        const taxable = Number(
          it.totalAmount != null
            ? it.totalAmount
            : (Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discountAmt || 0))
        ) || 0;

        let igst = 0;
        let cgst = 0;
        let sgst = 0;
        if (isInterState) {
          igst = taxable * (taxRate / 100);
        } else {
          cgst = taxable * (taxRate / 2 / 100);
          sgst = taxable * (taxRate / 2 / 100);
        }

        const totalVal = taxable + igst + cgst + sgst;
        const groupKey = `${hsn}_${uqc}_${taxRate}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            hsn,
            description: resolveHsnDescription(hsn, it.description, it.itemName),
            uqc,
            taxRate,
            isService,
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessAmount: 0
          };
        }

        const g = groups[groupKey];
        g.totalQuantity += qty;
        g.taxableValue += taxable;
        g.igstAmount += igst;
        g.cgstAmount += cgst;
        g.sgstAmount += sgst;
        g.totalValue += totalVal;
      });
    });

    const rows = Object.values(groups).sort((a, b) => a.hsn.localeCompare(b.hsn));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('HSN Summary');

    sheet.columns = [
      { header: 'HSN', key: 'hsn', width: 14 },
      { header: 'Description', key: 'description', width: 34 },
      { header: 'UQC', key: 'uqc', width: 10 },
      { header: 'Total Quantity', key: 'totalQuantity', width: 16 },
      { header: 'Total Value', key: 'totalValue', width: 18 },
      { header: 'Taxable Value', key: 'taxableValue', width: 18 },
      { header: 'Integrated Tax Amount', key: 'igstAmount', width: 22 },
      { header: 'Central Tax Amount', key: 'cgstAmount', width: 20 },
      { header: 'State/UT Tax Amount', key: 'sgstAmount', width: 20 },
      { header: 'Cess Amount', key: 'cessAmount', width: 14 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FF0F172A' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach((r) => {
      sheet.addRow({
        hsn: r.hsn,
        description: r.description,
        uqc: r.uqc,
        totalQuantity: r.isService && r.totalQuantity === 0 ? 0 : Number(r.totalQuantity.toFixed(2)),
        totalValue: Number(r.totalValue.toFixed(2)),
        taxableValue: Number(r.taxableValue.toFixed(2)),
        igstAmount: Number(r.igstAmount.toFixed(2)),
        cgstAmount: Number(r.cgstAmount.toFixed(2)),
        sgstAmount: Number(r.sgstAmount.toFixed(2)),
        cessAmount: Number(r.cessAmount.toFixed(2))
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_Table12_${gstin}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Error in exportTable12Excel: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GTA FREIGHT REVERSE CHARGE (RCM) TRACKER (SEC 9(3) & SEC 31(3)(f))
// ─────────────────────────────────────────────────────────────────────────────
exports.getFreightRcmLedger = async (req, res) => {
  try {
    const { companyEntity, startDate, endDate, settlementStatus, search } = req.query;

    const query = {};
    if (companyEntity && companyEntity !== 'ALL') {
      query.companyEntity = new RegExp(companyEntity.trim(), 'i');
    }

    if (settlementStatus && settlementStatus !== 'ALL') {
      query.settlementStatus = settlementStatus;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = startDate;
      if (endDate) query.billDate.$lte = endDate;
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { transporterName: new RegExp(q, 'i') },
        { lrNumber: new RegExp(q, 'i') },
        { billNo: new RegExp(q, 'i') },
        { selfInvoiceNumber: new RegExp(q, 'i') },
        { transporterGstin: new RegExp(q, 'i') }
      ];
    }

    const records = await db.FreightBill.find(query).sort({ billDate: -1, createdAt: -1 }).lean();

    const metrics = records.reduce(
      (acc, row) => {
        const freight = Number(row.freightAmount || 0);
        const rcmTax = Number(row.totalRcmTax || 0);

        acc.totalFreight += freight;
        acc.totalCashRcm += rcmTax; // Statutory cash payment (GSTR-3B 3.1(d))
        acc.totalIgst += Number(row.rcmIgst || 0);
        acc.totalCgst += Number(row.rcmCgst || 0);
        acc.totalSgst += Number(row.rcmSgst || 0);

        if (row.isEligibleItc) {
          acc.eligibleItc += rcmTax; // Simultaneous ITC claim (GSTR-3B 4(A)(3))
        }

        const isUnregistered = !row.transporterGstin || row.transporterGstin.trim().length === 0;
        if (isUnregistered && (!row.selfInvoiceNumber || row.selfInvoiceNumber.trim().length === 0)) {
          acc.pendingSelfInvoices += 1;
        }

        if (row.settlementStatus === 'PAID') {
          acc.settledCount += 1;
          acc.settledAmount += freight;
        } else {
          acc.pendingSettlementCount += 1;
          acc.pendingSettlementAmount += freight;
        }

        return acc;
      },
      {
        totalFreight: 0,
        totalCashRcm: 0,
        totalIgst: 0,
        totalCgst: 0,
        totalSgst: 0,
        eligibleItc: 0,
        pendingSelfInvoices: 0,
        settledCount: 0,
        settledAmount: 0,
        pendingSettlementCount: 0,
        pendingSettlementAmount: 0
      }
    );

    res.json({
      success: true,
      metrics: {
        totalFreight: Number(metrics.totalFreight.toFixed(2)),
        totalCashRcm: Number(metrics.totalCashRcm.toFixed(2)),
        totalIgst: Number(metrics.totalIgst.toFixed(2)),
        totalCgst: Number(metrics.totalCgst.toFixed(2)),
        totalSgst: Number(metrics.totalSgst.toFixed(2)),
        eligibleItc: Number(metrics.eligibleItc.toFixed(2)),
        pendingSelfInvoices: metrics.pendingSelfInvoices,
        settledCount: metrics.settledCount,
        settledAmount: Number(metrics.settledAmount.toFixed(2)),
        pendingSettlementCount: metrics.pendingSettlementCount,
        pendingSettlementAmount: Number(metrics.pendingSettlementAmount.toFixed(2))
      },
      records
    });
  } catch (err) {
    logger.error('Error in getFreightRcmLedger: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createFreightBill = async (req, res) => {
  try {
    const {
      companyEntity = 'Elite Digital Print',
      tenantGstin = '24AANFE0044M1ZG',
      lrNumber,
      billNo = '',
      billDate = new Date().toISOString().split('T')[0],
      transporterName,
      transporterGstin = '',
      originStateCode = '24',
      originStateName,
      destinationStateCode = '24',
      destinationStateName,
      sacCode = '9965',
      description = 'Goods Transport Agency (GTA) Freight Services',
      freightAmount,
      rcmRate = 5.0,
      isEligibleItc = true,
      settlementStatus = 'PENDING',
      paymentVoucherNo = '',
      paymentDate = '',
      vehicleNo = '',
      weightKg = 0,
      packagesCount = 0,
      notes = ''
    } = req.body;

    if (!lrNumber || !lrNumber.trim()) {
      return res.status(400).json({ success: false, error: 'LR / Bilty Number is mandatory.' });
    }
    if (!transporterName || !transporterName.trim()) {
      return res.status(400).json({ success: false, error: 'Transporter Name is mandatory.' });
    }
    const amt = Number(freightAmount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Freight Amount must be greater than zero.' });
    }

    const orgCode = String(originStateCode || '24').padStart(2, '0');
    const destCode = String(destinationStateCode || '24').padStart(2, '0');
    const isInterstate = orgCode !== destCode;
    const rate = Number(rcmRate) || 5.0;

    let rcmIgst = 0;
    let rcmCgst = 0;
    let rcmSgst = 0;

    if (isInterstate) {
      rcmIgst = Number((amt * (rate / 100)).toFixed(2));
    } else {
      rcmCgst = Number((amt * (rate / 2 / 100)).toFixed(2));
      rcmSgst = Number((amt * (rate / 2 / 100)).toFixed(2));
    }
    const totalRcmTax = Number((rcmIgst + rcmCgst + rcmSgst).toFixed(2));

    const newBill = await db.FreightBill.create({
      companyEntity,
      tenantGstin,
      lrNumber: lrNumber.trim(),
      billNo: billNo.trim(),
      billDate,
      transporterName: transporterName.trim(),
      transporterGstin: transporterGstin.trim().toUpperCase(),
      originStateCode: orgCode,
      originStateName: originStateName || STATE_NAMES[orgCode] || 'Gujarat',
      destinationStateCode: destCode,
      destinationStateName: destinationStateName || STATE_NAMES[destCode] || 'Gujarat',
      sacCode,
      description,
      freightAmount: amt,
      isInterstate,
      rcmRate: rate,
      rcmIgst,
      rcmCgst,
      rcmSgst,
      totalRcmTax,
      isEligibleItc: isEligibleItc !== false,
      selfInvoiceNumber: req.body.selfInvoiceNumber || '',
      selfInvoiceDate: req.body.selfInvoiceDate || '',
      settlementStatus,
      paymentVoucherNo,
      paymentDate,
      vehicleNo,
      weightKg: Number(weightKg) || 0,
      packagesCount: Number(packagesCount) || 0,
      notes
    });

    res.status(201).json({ success: true, record: newBill });
  } catch (err) {
    logger.error('Error in createFreightBill: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateFreightBill = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.FreightBill.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Freight bill not found.' });
    }

    const payload = { ...req.body };
    if (payload.freightAmount != null || payload.originStateCode || payload.destinationStateCode || payload.rcmRate) {
      const amt = payload.freightAmount != null ? Number(payload.freightAmount) : existing.freightAmount;
      const orgCode = String(payload.originStateCode || existing.originStateCode).padStart(2, '0');
      const destCode = String(payload.destinationStateCode || existing.destinationStateCode).padStart(2, '0');
      const isInterstate = orgCode !== destCode;
      const rate = payload.rcmRate != null ? Number(payload.rcmRate) : existing.rcmRate;

      let rcmIgst = 0;
      let rcmCgst = 0;
      let rcmSgst = 0;
      if (isInterstate) {
        rcmIgst = Number((amt * (rate / 100)).toFixed(2));
      } else {
        rcmCgst = Number((amt * (rate / 2 / 100)).toFixed(2));
        rcmSgst = Number((amt * (rate / 2 / 100)).toFixed(2));
      }

      payload.isInterstate = isInterstate;
      payload.rcmIgst = rcmIgst;
      payload.rcmCgst = rcmCgst;
      payload.rcmSgst = rcmSgst;
      payload.totalRcmTax = Number((rcmIgst + rcmCgst + rcmSgst).toFixed(2));
      payload.originStateName = STATE_NAMES[orgCode] || existing.originStateName;
      payload.destinationStateName = STATE_NAMES[destCode] || existing.destinationStateName;
    }

    const updated = await db.FreightBill.findByIdAndUpdate(id, payload, { new: true });
    res.json({ success: true, record: updated });
  } catch (err) {
    logger.error('Error in updateFreightBill: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteFreightBill = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.FreightBill.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Freight bill not found.' });
    }
    res.json({ success: true, message: 'Freight bill deleted successfully.' });
  } catch (err) {
    logger.error('Error in deleteFreightBill: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Batch Generate Self-Invoices (Section 31(3)(f))
exports.generateSelfInvoices = async (req, res) => {
  try {
    const { companyEntity, periodYear = new Date().getFullYear() } = req.body;

    const query = {
      $and: [
        {
          $or: [
            { transporterGstin: { $exists: false } },
            { transporterGstin: '' },
            { transporterGstin: null }
          ]
        },
        {
          $or: [
            { selfInvoiceNumber: { $exists: false } },
            { selfInvoiceNumber: '' },
            { selfInvoiceNumber: null }
          ]
        }
      ]
    };

    if (companyEntity && companyEntity !== 'ALL') {
      query.companyEntity = new RegExp(companyEntity.trim(), 'i');
    }

    const pendingBills = await db.FreightBill.find(query).sort({ billDate: 1, createdAt: 1 });
    if (!pendingBills.length) {
      return res.json({ success: true, count: 0, message: 'No pending unregistered bills require self-invoicing.' });
    }

    // Find highest existing sequence for this periodYear
    const pattern = new RegExp(`^SINV-${periodYear}-`, 'i');
    const lastSelfInv = await db.FreightBill.findOne({ selfInvoiceNumber: pattern })
      .sort({ selfInvoiceNumber: -1 })
      .lean();

    let nextSeq = 1;
    if (lastSelfInv && lastSelfInv.selfInvoiceNumber) {
      const parts = lastSelfInv.selfInvoiceNumber.split('-');
      if (parts.length >= 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let updatedCount = 0;

    for (const bill of pendingBills) {
      const selfInvNum = `SINV-${periodYear}-${String(nextSeq).padStart(5, '0')}`;
      bill.selfInvoiceNumber = selfInvNum;
      bill.selfInvoiceDate = todayStr;
      await bill.save();
      nextSeq += 1;
      updatedCount += 1;
    }

    res.json({ success: true, count: updatedCount, message: `Successfully generated ${updatedCount} self-invoices.` });
  } catch (err) {
    logger.error('Error in generateSelfInvoices: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Export Freight RCM Ledger to Excel
exports.exportFreightRcmExcel = async (req, res) => {
  try {
    const { companyEntity, startDate, endDate, gstin = '24AANFE0044M1ZG' } = req.query;

    const query = {};
    if (companyEntity && companyEntity !== 'ALL') {
      query.companyEntity = new RegExp(companyEntity.trim(), 'i');
    }
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = startDate;
      if (endDate) query.billDate.$lte = endDate;
    }

    const records = await db.FreightBill.find(query).sort({ billDate: 1 }).lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('GTA Freight RCM Ledger');

    sheet.columns = [
      { header: 'LR / Bilty No', key: 'lrNumber', width: 16 },
      { header: 'Bill No', key: 'billNo', width: 14 },
      { header: 'Bill Date', key: 'billDate', width: 13 },
      { header: 'Transporter Name', key: 'transporterName', width: 28 },
      { header: 'Transporter GSTIN', key: 'transporterGstin', width: 18 },
      { header: 'Origin State', key: 'originState', width: 14 },
      { header: 'Dest State', key: 'destState', width: 14 },
      { header: 'Freight Amount', key: 'freightAmount', width: 16 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'RCM Rate', key: 'rcmRate', width: 11 },
      { header: 'RCM IGST (₹)', key: 'rcmIgst', width: 15 },
      { header: 'RCM CGST (₹)', key: 'rcmCgst', width: 15 },
      { header: 'RCM SGST (₹)', key: 'rcmSgst', width: 15 },
      { header: 'Total Cash RCM (3.1(d))', key: 'totalRcmTax', width: 22 },
      { header: 'Eligible ITC (4(A)(3))', key: 'eligibleItc', width: 22 },
      { header: 'Self Invoice No (31(3)(f))', key: 'selfInvoiceNumber', width: 24 },
      { header: 'Self Invoice Date', key: 'selfInvoiceDate', width: 16 },
      { header: 'Settlement Status', key: 'settlementStatus', width: 16 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FF0F172A' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    records.forEach((r) => {
      sheet.addRow({
        lrNumber: r.lrNumber,
        billNo: r.billNo || '-',
        billDate: r.billDate,
        transporterName: r.transporterName,
        transporterGstin: r.transporterGstin || 'UNREGISTERED',
        originState: `${r.originStateName} (${r.originStateCode})`,
        destState: `${r.destinationStateName} (${r.destinationStateCode})`,
        freightAmount: r.freightAmount,
        type: r.isInterstate ? 'Inter-state' : 'Intra-state',
        rcmRate: `${r.rcmRate}%`,
        rcmIgst: r.rcmIgst,
        rcmCgst: r.rcmCgst,
        rcmSgst: r.rcmSgst,
        totalRcmTax: r.totalRcmTax,
        eligibleItc: r.isEligibleItc ? r.totalRcmTax : 0,
        selfInvoiceNumber: r.selfInvoiceNumber || (r.transporterGstin ? 'N/A (Registered)' : 'PENDING'),
        selfInvoiceDate: r.selfInvoiceDate || '-',
        settlementStatus: r.settlementStatus
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GTA_Freight_RCM_${gstin}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Error in exportFreightRcmExcel: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
