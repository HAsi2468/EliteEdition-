const mongoose = require('mongoose');
const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
const logger = require('../config/logger');

// Canonical list of sister companies & aliases (Strict matching: NO loose substrings)
const SISTER_COMPANIES = [
  {
    canonical: 'Ethno wear',
    fullAliases: ['ethno wear', 'ethnowear', 'ethno wear pvt ltd', 'ethno wear surat', 'ethno wear private limited'],
    exactCodes: ['ew']
  },
  {
    canonical: 'Sobise',
    fullAliases: ['sobise', 'sobise enterprise', 'sobise enterprises', 'sobise fashion', 'sobise creation', 'sobise surat'],
    exactCodes: ['so']
  },
  {
    canonical: 'Elite Edition',
    fullAliases: ['elite edition', 'elite edition surat', 'elite edition pvt ltd', 'elite edition private limited', 'elite edition apparel'],
    exactCodes: ['ee']
  },
  {
    canonical: 'Elite Fabtex',
    fullAliases: ['elite fabtex', 'elite fabtex surat', 'fabtex surat'],
    exactCodes: ['ef', 'efb']
  },
  {
    canonical: 'Elite Stitching',
    fullAliases: ['elite stitching', 'elite stitching unit', 'elite stitching surat'],
    exactCodes: ['es', 'est']
  },
  {
    canonical: 'Elite Digital Print',
    fullAliases: ['elite digital print', 'elite digital prints', 'elite digital print surat'],
    exactCodes: ['edp']
  },
  {
    canonical: 'Elite Online',
    fullAliases: ['elite online', 'elite online surat'],
    exactCodes: ['eon', 'eo']
  }
];

/**
 * Check if a raw material is a digital print consumable (ink, paper, etc.)
 */
function isDigitalPrintConsumable(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase().trim();
  return (
    n.includes('ink') ||
    n.includes('printdot') ||
    n.includes('grando') ||
    n.includes('sublimation') ||
    n.includes('butter paper') ||
    n.includes('butterpaper') ||
    n.includes('cmyk') ||
    n.includes('cyan') ||
    n.includes('magenta') ||
    n.includes('yellow') ||
    n.includes('black (k)') ||
    n.includes('cleaning solution')
  );
}

/**
 * Check if a company is a garment manufacturing / retail company (not digital printing)
 */
function isGarmentCompany(company) {
  if (!company) return true;
  const c = String(company).toLowerCase();
  return !c.includes('digital print') && c !== 'edp';
}

/**
 * Normalize any company name into its canonical sister company name (or null if not sister company)
 * STRICT RULES:
 * 1. Exact match against canonical name
 * 2. Exact match against short code ('ew', 'so', 'ee', etc.) - NEVER partial or substring!
 * 3. Exact or whole-phrase match against fullAliases - NEVER arbitrary partial substrings!
 */
function normalizeSisterCompany(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  for (const item of SISTER_COMPANIES) {
    // 1. Exact match against canonical
    if (clean === item.canonical.toLowerCase()) {
      return item.canonical;
    }
    // 2. Strict exact match for 2-3 letter codes (NEVER substring/includes)
    if (item.exactCodes && item.exactCodes.includes(clean)) {
      return item.canonical;
    }
    // 3. Strict full phrase matching (must be exact match, or clean starts with / ends with the full phrase)
    if (item.fullAliases) {
      for (const alias of item.fullAliases) {
        if (clean === alias || clean.startsWith(alias + ' ') || clean.endsWith(' ' + alias)) {
          return item.canonical;
        }
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
      // If customer is not a sister company, clean up any previous accidental sister records
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

      // CRITICAL GUARD: Garment companies NEVER receive ink or sublimation paper!
      if (isGarmentCompany(targetSister) && isDigitalPrintConsumable(materialName)) {
        logger.info(
          `[SisterCompanySync] Ignored digital consumable "${materialName}" from invoice #${invoice.invoiceNo} for garment entity "${targetSister}"`
        );
        continue;
      }

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

      // CRITICAL GUARD: Garment companies NEVER receive ink or sublimation paper!
      if (isGarmentCompany(targetSister) && isDigitalPrintConsumable(materialName)) {
        logger.info(
          `[SisterCompanySync] Ignored digital consumable "${materialName}" from delivery challan #${challan.challanNo} for garment entity "${targetSister}"`
        );
        continue;
      }

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
