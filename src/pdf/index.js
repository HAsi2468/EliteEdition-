/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - MAIN ORCHESTRATOR & SERVICE FACADE
 * Encapsulates Model -> ViewModel -> View pipeline and generates crisp PDF buffers.
 * ============================================================================
 */

const puppeteer = require('puppeteer');
const CompanyModel = require('./models/CompanyModel');
const { InvoiceModel } = require('./models/InvoiceModel');
const ProviderBillModel = require('./models/ProviderBillModel');
const InvoicePdfViewModel = require('./viewmodels/InvoicePdfViewModel');
const ProviderBillViewModel = require('./viewmodels/ProviderBillViewModel');
const InvoicePdfView = require('./views/InvoicePdfView');
const ProviderBillView = require('./views/ProviderBillView');

class MvvmPdfService {
  /**
   * Generates a Company Master Tax Invoice PDF using MVVM architecture
   * @param {Object} rawInvoiceData
   * @param {Object} rawCompanyData
   * @returns {Promise<Buffer>}
   */
  static async renderInvoicePdf(rawInvoiceData, rawCompanyData = {}) {
    // 1. Model Layer: instantiate and validate domain models
    const company = new CompanyModel(rawCompanyData);
    const invoice = new InvoiceModel(rawInvoiceData);

    // 2. ViewModel Layer: compute business logic, tax splits, words, tight dotted line
    const viewModel = new InvoicePdfViewModel(invoice, company);

    // 3. View Layer: compile HTML/CSS presentation
    const html = InvoicePdfView.render(viewModel);

    // 4. Render to PDF buffer via headless browser
    return this.htmlToPdf(html);
  }

  /**
   * Generates a Service Provider (AWS / MongoDB Atlas) PDF using MVVM architecture
   * @param {Object} rawProviderData
   * @returns {Promise<Buffer>}
   */
  static async renderProviderBillPdf(rawProviderData) {
    // 1. Model Layer
    const bill = new ProviderBillModel(rawProviderData);

    // 2. ViewModel Layer
    const viewModel = new ProviderBillViewModel(bill);

    // 3. View Layer
    const html = ProviderBillView.render(viewModel);

    // 4. Render to PDF buffer
    return this.htmlToPdf(html);
  }

  /**
   * Shared headless Chromium rendering engine with fallback support
   * @param {string} html
   * @returns {Promise<Buffer>}
   */
  static async htmlToPdf(html) {
    let browser = null;
    try {
      browser = await puppeteer.launch({
        executablePath: process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: ['load', 'networkidle0'], timeout: 20000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '6mm' }
      });

      return pdfBuffer;
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }
}

module.exports = {
  MvvmPdfService,
  CompanyModel,
  InvoiceModel,
  ProviderBillModel,
  InvoicePdfViewModel,
  ProviderBillViewModel,
  InvoicePdfView,
  ProviderBillView
};
