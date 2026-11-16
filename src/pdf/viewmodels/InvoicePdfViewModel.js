/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - VIEWMODEL LAYER: INVOICE PDF VIEWMODEL
 * Handles all business logic, tax computations, Indian currency formatting,
 * number-to-words transformation, and strict brand styling tokens.
 * ============================================================================
 */

class InvoicePdfViewModel {
  /**
   * @param {import('../models/InvoiceModel').InvoiceModel} invoiceModel
   * @param {import('../models/CompanyModel')} companyModel
   */
  constructor(invoiceModel, companyModel) {
    this.invoice = invoiceModel;
    this.company = companyModel;

    // 1. Compute line items and subtotal
    this.items = this.invoice.items.map((item, idx) => ({
      srNo: idx + 1,
      description: item.name,
      design: item.design,
      jobNo: item.jobNo,
      fabric: item.fabric,
      lot: item.lot,
      hsn: item.hsn,
      qtyFormatted: item.qty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      rateFormatted: item.rate.toFixed(2),
      amount: item.amount,
      amountFormatted: item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }));

    this.subtotal = this.invoice.taxable != null
      ? this.invoice.taxable
      : this.items.reduce((sum, item) => sum + item.amount, 0);

    // 2. Tax Computation (Inter-state vs Intra-state)
    const isInterState = this.invoice.customer.stateCode &&
      this.company.stateCode &&
      this.invoice.customer.stateCode !== this.company.stateCode;

    this.isInterState = isInterState;
    if (isInterState) {
      this.cgstRate = 0;
      this.sgstRate = 0;
      this.igstRate = 5.0;
      this.cgstAmount = 0;
      this.sgstAmount = 0;
      this.igstAmount = Math.round((this.subtotal * 0.05) * 100) / 100;
      this.totalTax = this.igstAmount;
    } else {
      this.cgstRate = 2.5;
      this.sgstRate = 2.5;
      this.igstRate = 0;
      this.cgstAmount = Math.round((this.subtotal * 0.025) * 100) / 100;
      this.sgstAmount = Math.round((this.subtotal * 0.025) * 100) / 100;
      this.igstAmount = 0;
      this.totalTax = this.cgstAmount + this.sgstAmount;
    }

    // 3. Totals, Round-off & Net Receivable
    const rawGrandTotal = this.subtotal + this.totalTax;
    this.grandTotal = Math.round(rawGrandTotal);
    this.roundOff = Math.round((this.grandTotal - rawGrandTotal) * 100) / 100;

    // Optional TDS deduction (194C / 194J)
    if (this.invoice.hasTds) {
      this.hasTds = true;
      this.tdsPercentage = this.invoice.tdsPercentage || 2;
      this.tdsAmount = Math.round((this.subtotal * (this.tdsPercentage / 100)) * 100) / 100;
      this.netReceivable = Math.round((this.grandTotal - this.tdsAmount) * 100) / 100;
    } else {
      this.hasTds = false;
      this.tdsAmount = 0;
      this.netReceivable = this.grandTotal;
    }

    // 4. Formatted Display Values
    this.subtotalFormatted = this.formatCurrency(this.subtotal);
    this.totalTaxFormatted = this.formatCurrency(this.totalTax);
    this.roundOffFormatted = (this.roundOff >= 0 ? '+' : '') + this.roundOff.toFixed(2);
    this.grandTotalFormatted = this.formatCurrency(this.grandTotal);
    this.netReceivableFormatted = this.formatCurrency(this.netReceivable);

    this.grandTotalWords = this.numberToWords(this.grandTotal);
    this.taxWords = this.numberToWords(this.totalTax);
    this.netReceivableWords = this.numberToWords(this.netReceivable);

    // 5. Strict User Signatory Rule Metrics (Small, tight centered dashed line as per uploaded image)
    this.signatoryDottedWidth = '140px';
    this.signatoryDottedBorder = '1.5px dashed #94a3b8';

    // 6. Brand Theme Styling Tokens
    this.theme = this.company.theme;
  }

  formatCurrency(num) {
    return Number(num || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  numberToWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      } else {
        str += a[n];
      }
      return str.trim();
    };

    const n = Math.floor(Math.abs(num));
    if (n === 0) return 'Rupees Zero Only';

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;

    let res = '';
    if (crore > 0) res += inWords(crore) + ' Crore ';
    if (lakh > 0) res += inWords(lakh) + ' Lakh ';
    if (thousand > 0) res += inWords(thousand) + ' Thousand ';
    if (remainder > 0) res += inWords(remainder);

    const decimals = Math.round((Math.abs(num) - n) * 100);
    let paiseStr = '';
    if (decimals > 0) {
      paiseStr = ' and ' + inWords(decimals) + ' Paise';
    }

    return 'Rupees ' + res.trim() + paiseStr + ' Only';
  }
}

module.exports = InvoicePdfViewModel;
