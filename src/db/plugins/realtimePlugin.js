/**
 * Mongoose Plugin for Automatic Real-Time Socket Event Emission
 * 
 * Automatically captures every write operation (save, findOneAndUpdate, updateOne,
 * findOneAndDelete, deleteOne, insertMany) across all models, ensuring that:
 * 1. API routes
 * 2. Bulk operations & imports
 * 3. Cron jobs & background workers
 * 
 * all trigger real-time updates without relying on manual controller calls.
 */

const eventBus = require('../../services/eventBus.service');
const { normalizeCompanyId } = require('../../config/company.constants');

// Entity name normalization map
const MODEL_TO_ENTITY = {
  JobCard: 'jobcard',
  GarmentJobCard: 'jobcard',
  JobPrintLog: 'jobcard',
  BillingInvoice: 'billing',
  BillingCustomer: 'billing',
  BillingItem: 'billing',
  SaleOrder: 'sales',
  SalesList: 'sales',
  Inventory: 'inventory',
  InventoryProduct: 'inventory',
  Product: 'inventory',
  StockOut: 'inventory',
  ReturnRecord: 'returns',
  Complaint: 'complaint',
  Expense: 'expense',
  Task: 'task',
  DesignerTask: 'designer_task',
  FabricChallan: 'fabric',
  StitchingChallan: 'fabric',
  RawMaterialTransaction: 'raw_material',
  Facility: 'facility',
  Party: 'party',
  Vendor: 'vendor',
  FabricVendor: 'vendor',
  Client: 'client'
};

function extractCompanyId(doc) {
  if (!doc) return null;
  const raw = doc.company_id || doc.companyId || doc.department || doc.companyEntity || doc.company;
  if (raw) return normalizeCompanyId(raw);
  if (doc._doc) {
    const rawDoc = doc._doc.company_id || doc._doc.companyId || doc._doc.department || doc._doc.companyEntity || doc._doc.company;
    if (rawDoc) return normalizeCompanyId(rawDoc);
  }
  return null;
}

function getEntityName(modelName) {
  if (!modelName) return 'system';
  return MODEL_TO_ENTITY[modelName] || modelName.toLowerCase();
}

function realtimePlugin(schema) {
  // Pre-save to check if this is an insert (new doc)
  schema.pre('save', function (next) {
    this.$wasNew = this.isNew;
    if (typeof next === 'function') {
      next();
    }
  });

  // Post-save hook: emitted after document is saved to MongoDB
  schema.post('save', function (doc) {
    if (!doc) return;
    try {
      const modelName = this.constructor.modelName;
      if (!modelName || modelName === 'OrderActivityLog' || modelName === 'ActivityLog' || modelName === 'ChatMessage') {
        return;
      }

      const entity = getEntityName(modelName);
      const action = this.$wasNew ? 'created' : 'updated';
      const companyId = extractCompanyId(doc);
      const version = doc.__v || 1;
      const updatedAt = doc.updatedAt || doc.modified_date_time || new Date();

      eventBus.publishDataChange({
        entity,
        id: doc._id,
        action,
        companyId,
        version,
        updatedAt
      });
    } catch (err) {
      console.warn('[realtimePlugin] Error in post-save hook:', err.message);
    }
  });

  // Post-findOneAndUpdate hook
  schema.post('findOneAndUpdate', function (result) {
    if (!result) return;
    try {
      const modelName = this.model?.modelName;
      if (!modelName || modelName === 'OrderActivityLog' || modelName === 'ActivityLog' || modelName === 'ChatMessage') {
        return;
      }

      const entity = getEntityName(modelName);
      const companyId = extractCompanyId(result);
      const version = result.__v || 1;
      const updatedAt = result.updatedAt || result.modified_date_time || new Date();

      eventBus.publishDataChange({
        entity,
        id: result._id,
        action: 'updated',
        companyId,
        version,
        updatedAt
      });
    } catch (err) {
      console.warn('[realtimePlugin] Error in post-findOneAndUpdate hook:', err.message);
    }
  });

  // Post-findOneAndDelete hook
  schema.post('findOneAndDelete', function (result) {
    if (!result) return;
    try {
      const modelName = this.model?.modelName;
      if (!modelName) return;

      const entity = getEntityName(modelName);
      const companyId = extractCompanyId(result);

      eventBus.publishDataChange({
        entity,
        id: result._id,
        action: 'deleted',
        companyId,
        version: (result.__v || 1) + 1,
        updatedAt: new Date()
      });
    } catch (err) {
      console.warn('[realtimePlugin] Error in post-findOneAndDelete hook:', err.message);
    }
  });

  // Post-insertMany hook (for bulk operations, imports, migrations)
  schema.post('insertMany', function (docs) {
    if (!Array.isArray(docs) || docs.length === 0) return;
    try {
      const modelName = docs[0]?.constructor?.modelName || this.model?.modelName;
      const entity = getEntityName(modelName);

      // Group inserts by companyId so we emit batched notifications per company
      const byCompany = new Map();
      docs.forEach((d) => {
        const cid = extractCompanyId(d) || 'all';
        if (!byCompany.has(cid)) byCompany.set(cid, []);
        byCompany.get(cid).push(d._id);
      });

      byCompany.forEach((ids, cid) => {
        eventBus.publishDataChange({
          entity,
          id: ids[0], // primary anchor ID
          action: 'created',
          companyId: cid,
          version: 1,
          updatedAt: new Date(),
          payload: { count: ids.length, bulk: true }
        });
      });
    } catch (err) {
      console.warn('[realtimePlugin] Error in post-insertMany hook:', err.message);
    }
  });
}

module.exports = realtimePlugin;
