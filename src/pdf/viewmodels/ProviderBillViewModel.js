/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - VIEWMODEL LAYER: PROVIDER BILL VIEWMODEL
 * Formats official service-provider tax invoices (AWS, MongoDB Atlas, etc.)
 * ============================================================================
 */

class ProviderBillViewModel {
  /**
   * @param {import('../models/ProviderBillModel')} billModel
   */
  constructor(billModel) {
    this.bill = billModel;
    
    this.isAws = this.bill.providerKey.includes('aws');
    this.isMongo = this.bill.providerKey.includes('mongo');
    
    // Theme colors per provider
    if (this.isAws) {
      this.theme = {
        primary: '#232f3e',
        accent: '#ff9900',
        badgeBg: '#fff3e0',
        badgeText: '#e65100',
        headerBorder: '#232f3e'
      };
      this.logoText = 'aws';
      this.documentTitle = 'Tax Invoice / Bill of Supply';
    } else if (this.isMongo) {
      this.theme = {
        primary: '#001e2b',
        accent: '#00ed64',
        badgeBg: '#e8f5e9',
        badgeText: '#1b5e20',
        headerBorder: '#00ed64'
      };
      this.logoText = 'MongoDB';
      this.documentTitle = 'Invoice & Account Statement';
    } else {
      this.theme = {
        primary: '#0f172a',
        accent: '#3b82f6',
        badgeBg: '#eff6ff',
        badgeText: '#1d4ed8',
        headerBorder: '#3b82f6'
      };
      this.logoText = this.bill.providerName;
      this.documentTitle = 'Service Invoice';
    }

    this.invoiceNo = this.bill.invoiceNo;
    this.invoiceDate = this.bill.invoiceDate;
    this.billingPeriod = this.bill.billingPeriod;
    this.accountNumber = this.bill.accountNumber;
    
    this.usdAmountFormatted = `$${this.bill.usdAmount.toFixed(2)}`;
    this.inrAmountFormatted = `₹ ${this.bill.inrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    this.items = this.bill.items.map((it, idx) => ({
      srNo: idx + 1,
      description: it.description || it.serviceName || it.name,
      usage: it.usage || it.region || 'ap-south-1 (Mumbai)',
      rate: it.rate != null ? `$${Number(it.rate).toFixed(4)}` : 'N/A',
      amountUsd: `$${Number(it.usd || it.amountUsd || 0).toFixed(2)}`,
      amountInr: `₹ ${Number(it.inr || it.amountInr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }));

    this.signatoryDottedWidth = '140px';
    this.signatoryDottedBorder = '1.5px dashed #94a3b8';
  }
}

module.exports = ProviderBillViewModel;
