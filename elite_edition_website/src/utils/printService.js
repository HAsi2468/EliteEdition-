/**
 * Elite Edition Enterprise Print Service
 * 
 * Provides:
 * - Dynamic @page stylesheet generation without locking out browser advance settings
 * - In-app Print Options Modal triggering
 * - Clean isolated iframe rendering with full font and stylesheet inheritance
 * - Fallback to standard window.open('_blank') with full printer selection features
 */

/**
 * Dispatches an event to open the Print Options Modal before printing.
 * @param {object} params
 * @param {string} params.title
 * @param {string|HTMLElement} params.content
 * @param {object} [params.defaultSettings]
 * @returns {Promise<boolean>}
 */
export const openPrintOptionsDialog = ({ title = 'Print Document', content = '', defaultSettings = {} }) => {
  return new Promise((resolve) => {
    let htmlContent = '';
    if (typeof content === 'string') {
      htmlContent = content;
    } else if (content instanceof HTMLElement) {
      htmlContent = content.outerHTML;
    }

    const event = new CustomEvent('elite-print-options', {
      detail: {
        title,
        content: htmlContent,
        defaultSettings,
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

/**
 * Builds dynamic CSS rules for print based on user selections.
 */
export const buildPrintStyles = ({
  paperSize = 'A4',
  orientation = 'portrait',
  margin = 'default',
  showHeaders = true,
  scale = 100
}) => {
  let sizeRule = '';
  if (paperSize === 'A4') {
    sizeRule = `size: A4 ${orientation};`;
  } else if (paperSize === 'A5') {
    sizeRule = `size: A5 ${orientation};`;
  } else if (paperSize === 'Letter') {
    sizeRule = `size: letter ${orientation};`;
  } else if (paperSize === 'thermal-80') {
    sizeRule = 'size: 80mm auto;';
  } else if (paperSize === 'thermal-58') {
    sizeRule = 'size: 58mm auto;';
  } else if (paperSize === 'sticker-4x6') {
    sizeRule = 'size: 100mm 150mm;';
  } else if (paperSize === 'sticker-100x25') {
    sizeRule = 'size: 100mm 25mm;';
  } else {
    // Auto - allow printer advance settings dialog to control page size
    sizeRule = orientation !== 'auto' ? `size: ${orientation};` : '';
  }

  let marginRule = 'margin: 10mm;';
  if (margin === 'minimum') marginRule = 'margin: 4mm;';
  else if (margin === 'none') marginRule = 'margin: 0mm;';
  else if (margin === 'custom') marginRule = 'margin: 6mm;';

  return `
    @page {
      ${sizeRule}
      ${marginRule}
      ${!showHeaders ? 'margin-top: 0mm; margin-bottom: 0mm;' : ''}
    }
    @media print {
      html, body {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        position: static !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      #root, #app, .app-container, .main-content, .workspace-container {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        position: static !important;
        display: block !important;
      }
      .no-print, .print-btn, .action-buttons, header, nav, aside {
        display: none !important;
      }
      table {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      ${scale !== 100 ? `body { zoom: ${scale}%; transform: scale(${scale / 100}); transform-origin: top left; }` : ''}
    }
  `;
};

/**
 * Ensures all images inside a document are fully loaded before opening the print dialog.
 * Prevents blank or missing images from appearing in printed PDFs and physical printouts.
 */
export const waitForImagesToLoad = (targetDoc, maxTimeoutMs = 12000) => {
  return new Promise((resolve) => {
    if (!targetDoc) return resolve();
    const imgs = Array.from(targetDoc.querySelectorAll('img'));
    if (imgs.length === 0) return resolve();

    let pending = imgs.length;
    let isSettled = false;

    const onImageDone = () => {
      if (isSettled) return;
      pending--;
      if (pending <= 0) {
        isSettled = true;
        resolve();
      }
    };

    // Safety timeout prevents browser print dialog from blocking indefinitely if an image fails to load
    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve();
      }
    }, maxTimeoutMs);

    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        onImageDone();
      } else {
        img.addEventListener('load', onImageDone, { once: true });
        img.addEventListener('error', onImageDone, { once: true });
        if (typeof img.decode === 'function') {
          img.decode().then(onImageDone).catch(onImageDone);
        }
      }
    });
  });
};

/**
 * Executes a clean isolated print job using an off-screen iframe.
 * If iframe printing is blocked, falls back to a standalone clean window.
 */
export const executeCleanPrint = ({
  contentHtml,
  title = 'Print Document',
  paperSize = 'A4',
  orientation = 'portrait',
  margin = 'default',
  showHeaders = true,
  scale = 100
}) => {
  return new Promise((resolve) => {
    const printStyles = buildPrintStyles({
      paperSize,
      orientation,
      margin,
      showHeaders,
      scale
    });

    // Gather existing stylesheets from the active document to preserve app look
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => link.outerHTML)
      .join('\n');
    
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map(style => style.outerHTML)
      .join('\n');

    // Create isolated invisible iframe with full layout viewport for accurate multi-page pagination
    const iframe = document.createElement('iframe');
    iframe.id = 'elite-print-isolated-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          ${styleLinks}
          ${inlineStyles}
          <style>
            ${printStyles}
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    const triggerPrint = async () => {
      try {
        // Guarantee all images inside iframe finish loading before print dialog is opened
        await waitForImagesToLoad(iframeDoc);
        await new Promise(r => setTimeout(r, 250));

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.open:', err);
        const printWindow = window.open('', '_blank', 'toolbar=yes,location=no,status=no,menubar=yes,scrollbars=yes,resizable=yes,width=1024,height=800');
        if (printWindow) {
          try {
            printWindow.document.open();
            printWindow.document.write(fullHtml);
            printWindow.document.close();
            await waitForImagesToLoad(printWindow.document);
            await new Promise(r => setTimeout(r, 250));
            printWindow.focus();
            printWindow.print();
          } catch(e) {}
        }
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve(true);
        }, 1500);
      }
    };

    if (iframe.contentWindow.document.readyState === 'complete') {
      triggerPrint();
    } else {
      iframe.onload = triggerPrint;
    }
  });
};
