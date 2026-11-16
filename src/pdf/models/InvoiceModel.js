/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - MODEL LAYER: INVOICE MODEL
 * Raw domain model encapsulating invoice header, customer, dispatch, and items.
 * ============================================================================
 */

class InvoiceItemModel {
  constructor(item = {}) {
    this.name = item.name || item.itemName || 'Job Work';
    this.design = item.design || item.designNo || item.sku || '';
    this.jobNo = item.jobNo || item.jobCardNo || '';
    this.fabric = item.fabric || item.fabricName || '';
    this.lot = item.lot || item.lotNo || '';
    this.hsn = String(item.hsn || item.hsnCode || '998821');
    this.gst = Number(item.gst || item.taxRate || 5);
    this.qty = Number(item.qty || item.quantity || 0);
    this.rate = Number(item.rate || item.unitPrice || 0);
    this.amount = Number(item.amount != null ? item.amount : (this.qty * this.rate));
  }
}

class InvoiceModel {
  constructor(data = {}) {
    this.id = data._id || data.id || '';
    this.invoiceNo = data.invoiceNo || 'DRAFT';
    this.invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
    this.dueDate = data.dueDate || '';
    this.placeOfSupply = data.placeOfSupply || 'Gujarat (24)';
    this.isReverseCharge = Boolean(data.isReverseCharge || false);
    
    // Customer profile
    const cust = data.customer || {};
    this.customer = {
      name: cust.name || cust.businessName || 'CASH CUSTOMER',
      address: cust.address || '',
      gstin: cust.gstin || 'URP',
      state: cust.state || 'Gujarat',
      stateCode: String(cust.stateCode || '24'),
      pan: cust.pan || ''
    };

    // Dispatch metadata
    const disp = data.dispatch || {};
    this.dispatch = {
      challans: disp.challans || data.linkedChallanNos?.join(', ') || data.ourChallanNo || 'N/A',
      transport: disp.transport || data.transportName || 'BY ROAD',
      vehicleNo: disp.vehicleNo || data.vehicleNo || '',
      agent: disp.agent || data.agentName || 'DIRECT',
      terms: disp.terms || 'DOOR DELIVERY / SURAT'
    };

    // Normalized items
    const rawItems = Array.isArray(data.items) ? data.items : [];
    this.items = rawItems.map(it => new InvoiceItemModel(it));

    // Optional override amounts
    this.taxable = data.taxable != null ? Number(data.taxable) : null;
    this.hasTds = Boolean(data.hasTds);
    this.tdsPercentage = Number(data.tdsPercentage || 2);
  }
}

module.exports = {
  InvoiceItemModel,
  InvoiceModel
};
