/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - MODEL LAYER: PROVIDER BILL MODEL
 * Domain model for infrastructure & cloud service provider expense invoices
 * (AWS, MongoDB Atlas, Cloudflare, Google Cloud, Razorpay, etc.)
 * ============================================================================
 */

class ProviderBillModel {
  constructor(data = {}) {
    this.providerKey = String(data.provider || data.vendor || 'aws').toLowerCase(); // 'aws' | 'mongodb' | 'cloudflare'
    this.providerName = data.providerName || (this.providerKey.includes('mongo') ? 'MongoDB Inc.' : 'Amazon Web Services, Inc.');
    this.providerAddress = data.providerAddress || (this.providerKey.includes('mongo')
      ? '1633 Broadway 38th Floor, New York, NY 10019 USA'
      : 'P.O. Box 84023, Seattle, WA 98124-8423 USA');
    this.providerGstin = data.providerGstin || (this.providerKey.includes('mongo') ? '9920USA29008OSR' : '9917USA29004OSR');
    
    this.accountNumber = data.accountNumber || data.accountId || (this.providerKey.includes('mongo') ? 'ORG-84920412' : '6546-5421-9842');
    this.invoiceNo = data.invoiceNo || `${this.providerKey.toUpperCase()}-${Date.now().toString().slice(-8)}`;
    this.invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
    this.billingPeriod = data.billingPeriod || 'October 1, 2026 - October 31, 2026';
    
    // Line items / service breakdowns
    this.items = Array.isArray(data.items) ? data.items : [];
    this.currency = data.currency || 'INR';
    this.exchangeRate = Number(data.exchangeRate || 86.50);
    this.usdAmount = Number(data.usdAmount || 0);
    this.inrAmount = Number(data.inrAmount || (this.usdAmount ? this.usdAmount * this.exchangeRate : 0));
    
    this.paymentStatus = data.paymentStatus || 'PAID (AUTO-DEBIT)';
    this.paymentMethod = data.paymentMethod || 'Kotak Visa Corporate Card (**9042)';
  }
}

module.exports = ProviderBillModel;
