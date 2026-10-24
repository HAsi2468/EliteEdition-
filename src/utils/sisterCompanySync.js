const mongoose = require('mongoose');
const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
const logger = require('../config/logger');

// Canonical list of sister companies & aliases
const SISTER_COMPANIES = [
  {
    canonical: 'Ethno wear',
    aliases: ['ethno wear', 'ethnowear', 'ethno', 'ew', 'ethno wear pvt', 'ethno wear surat']
  },
  {
    canonical: 'Sobise',
    aliases: ['sobise', 'so', 'sobise enterprise', 'sobise fashion']
  },
  {
    canonical: 'Elite Edition',
    aliases: ['elite edition', 'edition', 'ee', 'elite edition surat']
  },
  {
    canonical: 'Elite Fabtex',
    aliases: ['elite fabtex', 'fabtex', 'efb', 'ef']
  },
  {
    canonical: 'Elite Stitching',
    aliases: ['elite stitching', 'stitching', 'stitching unit', 'elite stitching unit', 'est', 'es']
  },
  {
    canonical: 'Elite Digital Print',
    aliases: ['elite digital print', 'elite digital prints', 'digital print', 'digital prints', 'edp']
  },
  {
    canonical: 'Elite Online',
    aliases: ['elite online', 'eon']
  }
];

/**
 * Normalize any company name into its canonical sister company name (or null if not sister company)
 */
function normalizeSisterCompany(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  for (const item of SISTER_COMPANIES) {
    if (clean === item.canonical.toLowerCase()) return item.canonical;
    for (const alias of item.aliases) {
      if (clean === alias || clean.startsWith(alias + ' ') || clean.endsWith(' ' + alias) || clean.includes(alias)) {
        return item.canonical;
      }
    }
  }
  return null;
}

/**
 * Check if customer/party corresponds to a sister company different from source company
 */
function getSisterCompanyFromParty(partyOrCustomer, sourceCompany) {
  let partyStr = '';
  if (typeof partyOrCustomer === 'string') {
    partyStr = partyOrCustomer;
  } else if (partyOrCustomer && typeof partyOrCustomer === 'object') {
    partyStr = partyOrCustomer.businessName || partyOrCustomer.name || '';
  }

  const targetSister = normalizeSisterCompany(partyStr);
  const sourceSister = normalizeSisterCompany(sourceCompany);

  if (targetSister && targetSister !== sourceSister) {
    return targetSister;
  }
  return null;
}

/**
 * Automatically sync Billing Invoice to Sister Company's Raw Material Inward
 */
async function syncInvoiceToSisterRawMaterial(invoice) {
  try {
    if (!invoice || !invoice.items || invoice.items.length === 0) return null;

    const sourceCompany = invoice.companyEntity || 'Elite Digital Print';
    const targetSister = getSisterCompanyFromParty(invoice.customer, sourceCompany);

    if (!targetSister) {
      // If customer is not a sister company, check if previous sister transactions exist and remove them
      await RawMaterialTransaction.deleteMany({
        sourceDocId: invoice._id,
        sourceDocType: 'INVOICE',
        verificationStatus: 'PENDING_CHECK'
      });
      return null;
    }

    // If invoice is cancelled, mark existing sister transactions as REJECTED
    if (invoice.invoiceStatus === 'CANCELLED') {
      await RawMaterialTransaction.updateMany(
        { sourceDocId: invoice._id, sourceDocType: 'INVOICE' },
        {
          $set: {
            verificationStatus: 'REJECTED',
            discrepancyReason: `Source Tax Invoice #${invoice.invoiceNo} was marked CANCELLED.`
          }
        }
      );
      return null;
    }

    // Delete previous unverified PENDING_CHECK transactions for this invoice before recreating
    await RawMaterialTransaction.deleteMany({
      sourceDocId: invoice._id,
      sourceDocType: 'INVOICE',
      verificationStatus: 'PENDING_CHECK'
    });

    const docsToCreate = [];
    for (const it of invoice.items) {
      const qty = parseFloat(it.qty) || 0;
      if (qty <= 0) continue;

      const materialName = it.fabricName || it.fabric || it.itemName || 'Fabric Material';
      docsToCreate.push({
        companyEntity: targetSister,
        type: 'INWARD',
        date: invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(),
        materialName,
        qty,
        unit: it.unit || 'Meters',
        challanNo: invoice.invoiceNo,
        vendorName: sourceCompany,
        unitPrice: parseFloat(it.unitPrice) || 0,
        totalAmount: parseFloat(it.totalAmount) || 0,
        notes: `Auto-inward from Sister Company: ${sourceCompany} via Tax Invoice #${invoice.invoiceNo}`,
        isSisterTransfer: true,
        sourceCompany,
        sourceDocType: 'INVOICE',
        sourceDocId: invoice._id,
        sourceDocModel: 'BillingInvoice',
        sourceDocNo: invoice.invoiceNo,
        verificationStatus: 'PENDING_CHECK'
      });
    }

    if (docsToCreate.length > 0) {
      const created = await RawMaterialTransaction.insertMany(docsToCreate);
      logger.info(
        `[SisterCompanySync] Created ${created.length} pending Raw Material Inward records for ${targetSister} from Invoice #${invoice.invoiceNo} (${sourceCompany})`
      );
      return created;
    }

    return null;
  } catch (err) {
    logger.error('[SisterCompanySync] Error syncing invoice to sister raw material: %o', err);
    return null;
  }
}

/**
 * Automatically sync Delivery Challan to Sister Company's Raw Material Inward
 */
async function syncDeliveryChallanToSisterRawMaterial(challan) {
  try {
    if (!challan || !challan.items || challan.items.length === 0) return null;

    const sourceCompany = challan.companyEntity || 'Sobise';
    const targetSister = getSisterCompanyFromParty(challan.customer, sourceCompany);

    if (!targetSister) {
      await RawMaterialTransaction.deleteMany({
        sourceDocId: challan._id,
        sourceDocType: 'DELIVERY_CHALLAN',
        verificationStatus: 'PENDING_CHECK'
      });
      return null;
    }

    if (challan.status === 'CANCELLED') {
      await RawMaterialTransaction.updateMany(
        { sourceDocId: challan._id, sourceDocType: 'DELIVERY_CHALLAN' },
        {
          $set: {
            verificationStatus: 'REJECTED',
            discrepancyReason: `Source Delivery Challan #${challan.challanNo} was marked CANCELLED.`
          }
        }
      );
      return null;
    }

    // Delete previous unverified PENDING_CHECK transactions for this challan before recreating
    await RawMaterialTransaction.deleteMany({
      sourceDocId: challan._id,
      sourceDocType: 'DELIVERY_CHALLAN',
      verificationStatus: 'PENDING_CHECK'
    });

    const docsToCreate = [];
    for (const it of challan.items) {
      const qty = parseFloat(it.qty) || 0;
      if (qty <= 0) continue;

      const materialName = it.itemName || it.description || 'Dispatched Material';
      docsToCreate.push({
        companyEntity: targetSister,
        type: 'INWARD',
        date: challan.challanDate ? new Date(challan.challanDate) : new Date(),
        materialName,
        qty,
        unit: it.unit || 'Pcs',
        challanNo: challan.challanNo,
        vendorName: sourceCompany,
        unitPrice: parseFloat(it.unitPrice) || 0,
        totalAmount: parseFloat(it.totalAmount) || 0,
        notes: `Auto-inward from Sister Company: ${sourceCompany} via Delivery Challan #${challan.challanNo}`,
        isSisterTransfer: true,
        sourceCompany,
        sourceDocType: 'DELIVERY_CHALLAN',
        sourceDocId: challan._id,
        sourceDocModel: 'DeliveryChallan',
        sourceDocNo: challan.challanNo,
        verificationStatus: 'PENDING_CHECK'
      });
    }

    if (docsToCreate.length > 0) {
      const created = await RawMaterialTransaction.insertMany(docsToCreate);
      logger.info(
        `[SisterCompanySync] Created ${created.length} pending Raw Material Inward records for ${targetSister} from Delivery Challan #${challan.challanNo} (${sourceCompany})`
      );
      return created;
    }

    return null;
  } catch (err) {
    logger.error('[SisterCompanySync] Error syncing delivery challan to sister raw material: %o', err);
    return null;
  }
}

/**
 * Automatically sync Fabric Challan (Digital Print Outward) to Sister Company's Raw Material Inward
 */
async function syncFabricChallanToSisterRawMaterial(fabricChallan) {
  try {
    if (!fabricChallan) return null;

    const sourceCompany = fabricChallan.companyEntity || 'Elite Digital Print';
    const targetSister = getSisterCompanyFromParty(fabricChallan.partyName, sourceCompany);

    if (!targetSister) {
      await RawMaterialTransaction.deleteMany({
        sourceDocId: fabricChallan._id,
        sourceDocType: 'FABRIC_CHALLAN',
        verificationStatus: 'PENDING_CHECK'
      });
      return null;
    }

    // Delete previous unverified PENDING_CHECK transactions for this challan
    await RawMaterialTransaction.deleteMany({
      sourceDocId: fabricChallan._id,
      sourceDocType: 'FABRIC_CHALLAN',
      verificationStatus: 'PENDING_CHECK'
    });

    const totalMeters = (fabricChallan.tpDetails || []).reduce(
      (sum, tp) => sum + (parseFloat(tp.freshMtr) || parseFloat(tp.tpMeter) || 0),
      0
    );

    const doc = await RawMaterialTransaction.create({
      companyEntity: targetSister,
      type: 'INWARD',
      date: fabricChallan.date ? new Date(fabricChallan.date) : new Date(),
      materialName: fabricChallan.fabricName || 'Printed Fabric',
      qty: totalMeters > 0 ? totalMeters : 1,
      unit: 'Meters',
      challanNo: String(fabricChallan.challanNo || ''),
      vendorName: sourceCompany,
      notes: `Auto-inward from Sister Company: ${sourceCompany} via Fabric Challan #${fabricChallan.challanNo} (Lot: ${fabricChallan.lotNo || '-'})`,
      isSisterTransfer: true,
      sourceCompany,
      sourceDocType: 'FABRIC_CHALLAN',
      sourceDocId: fabricChallan._id,
      sourceDocModel: 'FabricChallan',
      sourceDocNo: String(fabricChallan.challanNo || ''),
      verificationStatus: 'PENDING_CHECK'
    });

    logger.info(
      `[SisterCompanySync] Created pending Raw Material Inward for ${targetSister} from Fabric Challan #${fabricChallan.challanNo}`
    );
    return doc;
  } catch (err) {
    logger.error('[SisterCompanySync] Error syncing fabric challan to sister raw material: %o', err);
    return null;
  }
}

module.exports = {
  SISTER_COMPANIES,
  normalizeSisterCompany,
  getSisterCompanyFromParty,
  syncInvoiceToSisterRawMaterial,
  syncDeliveryChallanToSisterRawMaterial,
  syncFabricChallanToSisterRawMaterial
};
