const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const logger = require('../config/logger');

/**
 * Safely resolves a nested dot-notation path on an object
 * e.g. getNestedValue({ invoice: { customer: { gstin: '24AAAAA0000A1Z5' } } }, 'invoice.customer.gstin')
 */
const getNestedValue = (obj, path) => {
  if (!obj || !path) return '';
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return '';
    curr = curr[part];
  }
  return curr !== undefined && curr !== null ? curr : '';
};

/**
 * Replaces {{nested.token}} in a string with values from dataContext
 */
const resolveTokensInString = (templateStr, dataContext) => {
  if (!templateStr || typeof templateStr !== 'string') return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, tokenKey) => {
    const val = getNestedValue(dataContext, tokenKey);
    if (val === '') return '';
    if (typeof val === 'number') {
      if (tokenKey.toLowerCase().includes('total') || tokenKey.toLowerCase().includes('rate') || tokenKey.toLowerCase().includes('amount') || tokenKey.toLowerCase().includes('tax') || tokenKey.toLowerCase().includes('balance')) {
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return val.toString();
    }
    return val;
  });
};

/**
 * Compiles a DocumentTemplate schema + transactional dataContext into print-ready HTML
 */
const compileTemplateToHtml = async (template, dataContext = {}) => {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    margins = { top: 20, bottom: 20, left: 20, right: 20 },
    watermark = {},
    stamp = {},
    elements = []
  } = template;

  const isLandscape = orientation === 'landscape';
  
  // Dimensions in points (72 pt per inch)
  let baseWidth = 595;
  let baseHeight = 842;

  if (pageSize === 'A5') {
    baseWidth = 420;
    baseHeight = 595;
  } else if (pageSize === '4x6') {
    baseWidth = 288;
    baseHeight = 432;
  } else if (pageSize === '3x2') {
    baseWidth = 216;
    baseHeight = 144;
  }

  const canvasWidth = isLandscape ? baseHeight : baseWidth;
  const canvasHeight = isLandscape ? baseWidth : baseHeight;

  let elementsHtml = '';

  for (const el of elements) {
    const {
      type = 'text',
      x = 0,
      y = 0,
      width = 100,
      height = 30,
      content = '',
      fieldBinding = '',
      tableConfig = {},
      style = {}
    } = el;

    const baseStyle = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
      font-size: ${style.fontSize || 12}px;
      font-weight: ${style.fontWeight || 'normal'};
      font-style: ${style.fontStyle || 'normal'};
      text-align: ${style.textAlign || 'left'};
      color: ${style.color || '#0f172a'};
      background-color: ${style.backgroundColor || 'transparent'};
      border: ${style.borderWidth ? `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'}` : 'none'};
      border-radius: ${style.borderRadius || 0}px;
      padding: ${style.padding || 0}px;
      box-sizing: border-box;
      letter-spacing: ${style.letterSpacing || 'normal'};
      line-height: ${style.lineHeight || 1.3};
      z-index: ${style.zIndex || 1};
      overflow: hidden;
    `;

    if (type === 'divider') {
      elementsHtml += `
        <div style="${baseStyle} border-top: ${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'}; height: 0; min-height: 0;"></div>
      `;
    } else if (type === 'rect') {
      elementsHtml += `
        <div style="${baseStyle}"></div>
      `;
    } else if (type === 'image') {
      const src = content || getNestedValue(dataContext, fieldBinding) || '';
      elementsHtml += `
        <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
          ${src ? `<img src="${src}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
        </div>
      `;
    } else if (type === 'qr_code') {
      const qrData = content ? resolveTokensInString(content, dataContext) : getNestedValue(dataContext, fieldBinding) || 'https://eliteedition.in';
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(String(qrData), { margin: 1, width: width * 2 });
      } catch (qrErr) {
        logger.warn('Failed to render QR Code in PDF: %o', qrErr);
      }
      elementsHtml += `
        <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
          ${qrDataUrl ? `<img src="${qrDataUrl}" style="width: 100%; height: 100%; object-fit: contain;" />` : ''}
        </div>
      `;
    } else if (type === 'dynamic_table') {
      const items = (dataContext.invoice?.items || dataContext.items || dataContext.challan?.items || dataContext.jobCard?.items || []);
      const columns = tableConfig.columns || [
        { label: 'Item / Description', field: 'name', width: '40%', align: 'left' },
        { label: 'HSN/SAC', field: 'hsn', width: '15%', align: 'center' },
        { label: 'Qty', field: 'quantity', width: '15%', align: 'right' },
        { label: 'Rate', field: 'rate', width: '15%', align: 'right' },
        { label: 'Amount', field: 'total', width: '15%', align: 'right' }
      ];

      const headerBg = tableConfig.headerBg || '#f8fafc';
      const headerColor = tableConfig.headerColor || '#0f172a';
      const borderColor = tableConfig.borderColor || '#e2e8f0';
      const rowHeight = tableConfig.rowHeight || 26;

      let tableRows = '';
      items.forEach((item, idx) => {
        const bg = tableConfig.striped && idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        tableRows += `<tr style="background-color: ${bg}; height: ${rowHeight}px;">`;
        columns.forEach((col) => {
          let val = getNestedValue(item, col.field || col.key);
          if (typeof val === 'number') {
            if (col.label.toLowerCase().includes('rate') || col.label.toLowerCase().includes('amount') || col.label.toLowerCase().includes('total') || col.label.toLowerCase().includes('tax')) {
              val = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
          tableRows += `
            <td style="border: 1px solid ${borderColor}; padding: 4px 6px; font-size: ${style.fontSize || 10}px; text-align: ${col.align || 'left'}; color: ${style.color || '#1e293b'};">
              ${val !== undefined && val !== null ? val : ''}
            </td>
          `;
        });
        tableRows += `</tr>`;
      });

      // Blank filler rows if items count is small to maintain table structure
      const minRows = 4;
      if (items.length < minRows) {
        for (let i = items.length; i < minRows; i++) {
          tableRows += `<tr style="height: ${rowHeight}px;">`;
          columns.forEach(() => {
            tableRows += `<td style="border: 1px solid ${borderColor}; padding: 4px 6px;">&nbsp;</td>`;
          });
          tableRows += `</tr>`;
        }
      }

      elementsHtml += `
        <div style="${baseStyle} overflow: visible;">
          <table style="width: 100%; border-collapse: collapse; font-family: inherit;">
            ${tableConfig.showHeader !== false ? `
              <thead>
                <tr style="background-color: ${headerBg}; height: ${rowHeight + 4}px;">
                  ${columns.map(c => `
                    <th style="border: 1px solid ${borderColor}; padding: 4px 6px; font-size: ${(style.fontSize || 10) + 1}px; font-weight: 700; text-align: ${c.align || 'left'}; color: ${headerColor}; width: ${c.width || 'auto'};">
                      ${c.label}
                    </th>
                  `).join('')}
                </tr>
              </thead>
            ` : ''}
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Standard or Dynamic Text
      let textToRender = content;
      if (fieldBinding) {
        const boundVal = getNestedValue(dataContext, fieldBinding);
        textToRender = boundVal !== '' ? String(boundVal) : content;
      }
      textToRender = resolveTokensInString(textToRender, dataContext);

      elementsHtml += `
        <div style="${baseStyle} white-space: pre-wrap; word-break: break-word;">
          ${textToRender}
        </div>
      `;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${template.name || 'Document'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${pageSize} ${orientation};
          margin: 0;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: ${canvasWidth}px;
          height: ${canvasHeight}px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #ffffff;
          overflow: hidden;
        }
        .canvas-sheet {
          position: relative;
          width: ${canvasWidth}px;
          height: ${canvasHeight}px;
          background: #ffffff;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      <div class="canvas-sheet">
        ${watermark && watermark.enabled && watermark.text ? `
          <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 56px; font-weight: 900; color: rgba(15, 23, 42, ${watermark.opacity || 0.08}); white-space: nowrap; pointer-events: none; text-transform: uppercase; letter-spacing: 0.12em; z-index: 0; user-select: none;">
            ${watermark.text}
          </div>
        ` : ''}

        ${stamp && stamp.enabled && stamp.text ? `
          <div style="position: absolute; top: 22px; right: 25px; transform: rotate(-8deg); border: 2.5px dashed ${stamp.color || '#dc2626'}; color: ${stamp.color || '#dc2626'}; padding: 4px 14px; font-size: 11px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; border-radius: 4px; z-index: 998; opacity: 0.9; pointer-events: none;">
            ${stamp.text}
          </div>
        ` : ''}

        ${elementsHtml}
      </div>
    </body>
    </html>
  `;

  return html;
};

/**
 * Generates an A4 / Thermal Label PDF Buffer using headless Chrome via Puppeteer
 */
const generatePdfFromTemplate = async (template, dataContext = {}) => {
  const html = await compileTemplateToHtml(template, dataContext);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const isLandscape = template.orientation === 'landscape';
    const pdfOptions = {
      landscape: isLandscape,
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    };

    if (template.pageSize === '4x6') {
      pdfOptions.width = isLandscape ? '6in' : '4in';
      pdfOptions.height = isLandscape ? '4in' : '6in';
    } else if (template.pageSize === '3x2') {
      pdfOptions.width = isLandscape ? '3in' : '2in';
      pdfOptions.height = isLandscape ? '2in' : '3in';
    } else {
      pdfOptions.format = template.pageSize || 'A4';
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    return pdfBuffer;
  } catch (error) {
    logger.error('Error generating PDF with Puppeteer: %o', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

/**
 * Generates a Consolidated Multi-Page PDF Booklet from an array of dataContexts
 * Perfect for bulk printing 10-50 invoices or delivery challans
 */
const generateBatchPdfFromTemplate = async (template, dataContexts = [], copyOption = 'ORIGINAL') => {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    watermark = {},
    stamp: templateStamp = {},
    elements = []
  } = template;

  const isLandscape = orientation === 'landscape';

  let baseWidth = 595;
  let baseHeight = 842;
  if (pageSize === 'A5') { baseWidth = 420; baseHeight = 595; }
  else if (pageSize === '4x6') { baseWidth = 288; baseHeight = 432; }
  else if (pageSize === '3x2') { baseWidth = 216; baseHeight = 144; }

  const canvasWidth = isLandscape ? baseHeight : baseWidth;
  const canvasHeight = isLandscape ? baseWidth : baseHeight;

  // Pre-generate QR codes if any
  const qrCache = {};
  for (const el of elements) {
    if (el.type === 'qr_code' && el.content) {
      for (const ctx of dataContexts) {
        const payload = resolveTokensInString(el.content, ctx);
        if (payload && !qrCache[payload]) {
          try {
            qrCache[payload] = await QRCode.toDataURL(payload, { margin: 1, width: (el.width || 80) * 2 });
          } catch (e) {
            logger.warn('Batch QR gen error:', e);
          }
        }
      }
    }
  }

  const renderSheet = (ctx, activeStamp) => {
    let elementsHtml = '';

    for (const el of elements) {
      const {
        type = 'text',
        x = 0,
        y = 0,
        width = 100,
        height = 30,
        content = '',
        fieldBinding = '',
        tableConfig = {},
        style = {}
      } = el;

      const baseStyle = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${width}px;
        height: ${height}px;
        font-size: ${style.fontSize || 12}px;
        font-weight: ${style.fontWeight || 'normal'};
        font-style: ${style.fontStyle || 'normal'};
        text-align: ${style.textAlign || 'left'};
        color: ${style.color || '#0f172a'};
        background-color: ${style.backgroundColor || 'transparent'};
        border: ${style.borderWidth || 0}px ${style.borderStyle || 'solid'} ${style.borderColor || 'transparent'};
        border-radius: ${style.borderRadius || 0}px;
        padding: ${style.padding || 0}px;
        line-height: ${style.lineHeight || 1.25};
        box-sizing: border-box;
        overflow: hidden;
        z-index: ${style.zIndex || 1};
      `;

      if (type === 'rect') {
        elementsHtml += `<div style="${baseStyle}"></div>`;
      } else if (type === 'divider') {
        elementsHtml += `<div style="${baseStyle} border-bottom: ${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'};"></div>`;
      } else if (type === 'image') {
        const src = content ? resolveTokensInString(content, ctx) : '';
        elementsHtml += `
          <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
            ${src ? `<img src="${src}" alt="" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
          </div>
        `;
      } else if (type === 'qr_code') {
        const rawPayload = content ? resolveTokensInString(content, ctx) : '';
        const qrDataUrl = qrCache[rawPayload] || '';
        elementsHtml += `
          <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width: 100%; height: 100%; object-fit: contain;" />` : ''}
          </div>
        `;
      } else if (type === 'dynamic_table') {
        const rows = ctx.items || [];
        const cols = tableConfig.columns || [];

        elementsHtml += `
          <div style="${baseStyle} overflow: visible;">
            <table style="width: 100%; border-collapse: collapse; font-size: ${style.fontSize || 10}px; color: ${style.color || '#0f172a'};">
              ${tableConfig.showHeader !== false ? `
                <thead>
                  <tr style="background-color: ${tableConfig.headerBg || '#0f172a'}; color: ${tableConfig.headerColor || '#ffffff'};">
                    ${cols.map(c => `
                      <th style="padding: 5px 6px; text-align: ${c.align || 'left'}; width: ${c.width || 'auto'}; font-weight: 700; border: 1px solid ${tableConfig.borderColor || '#cbd5e1'}; font-size: 0.85em;">
                        ${c.label}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
              ` : ''}
              <tbody>
                ${rows.map((row, idx) => `
                  <tr style="background-color: ${tableConfig.striped && idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; height: ${tableConfig.rowHeight || 24}px;">
                    ${cols.map(c => {
                      let cellVal = c.field === 'index' ? idx + 1 : (row[c.field] !== undefined ? row[c.field] : '');
                      if (typeof cellVal === 'number' && (c.field.toLowerCase().includes('rate') || c.field.toLowerCase().includes('total') || c.field.toLowerCase().includes('amount'))) {
                        cellVal = cellVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      }
                      return `
                        <td style="padding: 4px 6px; text-align: ${c.align || 'left'}; border: 1px solid ${tableConfig.borderColor || '#cbd5e1'};">
                          ${cellVal}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        let textToRender = content;
        if (fieldBinding) {
          const boundVal = getNestedValue(ctx, fieldBinding);
          textToRender = boundVal !== '' ? String(boundVal) : content;
        }
        textToRender = resolveTokensInString(textToRender, ctx);

        elementsHtml += `
          <div style="${baseStyle} white-space: pre-wrap; word-break: break-word;">
            ${textToRender}
          </div>
        `;
      }
    }

    return `
      <div class="sheet-container">
        <div class="canvas-sheet">
          ${watermark && watermark.enabled && watermark.text ? `
            <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 56px; font-weight: 900; color: rgba(15, 23, 42, ${watermark.opacity || 0.08}); white-space: nowrap; pointer-events: none; text-transform: uppercase; letter-spacing: 0.12em; z-index: 0; user-select: none;">
              ${watermark.text}
            </div>
          ` : ''}

          ${activeStamp && activeStamp.enabled && activeStamp.text ? `
            <div style="position: absolute; top: 22px; right: 25px; transform: rotate(-8deg); border: 2.5px dashed ${activeStamp.color || '#dc2626'}; color: ${activeStamp.color || '#dc2626'}; padding: 4px 14px; font-size: 11px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; border-radius: 4px; z-index: 998; opacity: 0.9; pointer-events: none;">
              ${activeStamp.text}
            </div>
          ` : ''}

          ${elementsHtml}
        </div>
      </div>
    `;
  };

  let allSheetsHtml = '';
  for (const ctx of dataContexts) {
    if (copyOption === 'BOTH') {
      const origStamp = { enabled: true, text: 'ORIGINAL FOR RECIPIENT', color: '#0284c7' };
      const dupStamp = { enabled: true, text: 'DUPLICATE FOR TRANSPORTER', color: '#dc2626' };
      allSheetsHtml += renderSheet(ctx, origStamp);
      allSheetsHtml += renderSheet(ctx, dupStamp);
    } else if (copyOption === 'DUPLICATE') {
      const dupStamp = { enabled: true, text: 'DUPLICATE FOR TRANSPORTER', color: '#dc2626' };
      allSheetsHtml += renderSheet(ctx, dupStamp);
    } else {
      const origStamp = { enabled: true, text: 'ORIGINAL FOR RECIPIENT', color: '#0284c7' };
      allSheetsHtml += renderSheet(ctx, origStamp);
    }
  }

  const batchHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Batch Print Booklet</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${pageSize} ${orientation};
          margin: 0;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #ffffff;
        }
        .sheet-container {
          page-break-after: always;
          break-after: page;
          width: ${canvasWidth}px;
          height: ${canvasHeight}px;
          position: relative;
          overflow: hidden;
        }
        .canvas-sheet {
          position: relative;
          width: ${canvasWidth}px;
          height: ${canvasHeight}px;
          background: #ffffff;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      ${allSheetsHtml}
    </body>
    </html>
  `;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(batchHtml, { waitUntil: 'networkidle0', timeout: 60000 });

    const pdfOptions = {
      landscape: isLandscape,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    };

    if (template.pageSize === '4x6') {
      pdfOptions.width = isLandscape ? '6in' : '4in';
      pdfOptions.height = isLandscape ? '4in' : '6in';
    } else if (template.pageSize === '3x2') {
      pdfOptions.width = isLandscape ? '3in' : '2in';
      pdfOptions.height = isLandscape ? '2in' : '3in';
    } else {
      pdfOptions.format = template.pageSize || 'A4';
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    return pdfBuffer;
  } catch (error) {
    logger.error('Error generating Batch PDF with Puppeteer: %o', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

module.exports = {
  compileTemplateToHtml,
  generatePdfFromTemplate,
  generateBatchPdfFromTemplate,
  resolveTokensInString,
  getNestedValue
};
