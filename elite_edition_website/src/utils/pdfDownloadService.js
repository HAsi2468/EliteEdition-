/**
 * Elite Edition Enterprise PDF Download & Preview Service
 * 
 * Provides:
 * - Robust Blob handling with explicit application/pdf MIME typing
 * - Delayed object URL revocation to prevent corrupted/0-byte downloads on mobile/PWA
 * - Native sharing integration via navigator.canShare({ files: [file] })
 * - In-app PDF preview modal dispatching
 */

import { triggerPushNotification } from '../components/NotificationToast';

/**
 * Ensures the given data is converted to an explicitly typed application/pdf Blob.
 * @param {Blob|ArrayBuffer|Uint8Array|string} rawData 
 * @returns {Blob}
 */
export const ensurePdfBlob = (rawData) => {
  if (rawData instanceof Blob) {
    if (rawData.type === 'application/pdf') {
      return rawData;
    }
    // Re-wrap blob with explicit application/pdf
    return new Blob([rawData], { type: 'application/pdf' });
  }
  return new Blob([rawData], { type: 'application/pdf' });
};

/**
 * Checks if the browser environment supports file sharing.
 * @param {Blob} blob 
 * @param {string} fileName 
 * @returns {boolean}
 */
export const canSharePdf = (blob, fileName = 'document.pdf') => {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const testFile = new File([blob || new Blob()], fileName, { type: 'application/pdf' });
    return navigator.canShare({ files: [testFile] });
  } catch (e) {
    return false;
  }
};

/**
 * Shares a PDF file using the native device share sheet (iOS/Android/macOS).
 * @param {Blob} blob 
 * @param {string} fileName 
 * @param {string} title 
 */
export const sharePdf = async (blob, fileName = 'document.pdf', title = 'Document') => {
  const pdfBlob = ensurePdfBlob(blob);
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const file = new File([pdfBlob], cleanName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: title || cleanName,
        text: `Elite Edition ERP: ${title || cleanName}`
      });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share operation failed, falling back:', err);
      }
      return false;
    }
  }
  return false;
};

/**
 * Triggers the in-app PDF preview modal.
 * @param {object} params
 * @param {Blob} params.blob
 * @param {string} [params.url]
 * @param {string} [params.fileName='document.pdf']
 * @param {string} [params.title='Document Preview']
 */
export const triggerPdfPreview = ({ blob, url, fileName = 'document.pdf', title = 'Document Preview' }) => {
  const pdfBlob = blob ? ensurePdfBlob(blob) : null;
  const event = new CustomEvent('elite-pdf-preview', {
    detail: {
      blob: pdfBlob,
      url,
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      title
    }
  });
  window.dispatchEvent(event);
};

/**
 * Programmatically downloads a PDF blob with safe delayed revocation.
 * @param {Blob} rawBlob 
 * @param {string} fileName 
 * @param {number} [revokeDelay=2500] 
 */
export const triggerDirectDownload = (rawBlob, fileName = 'document.pdf', revokeDelay = 2500) => {
  const pdfBlob = ensurePdfBlob(rawBlob);
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const objectUrl = window.URL.createObjectURL(pdfBlob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.setAttribute('download', cleanName);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Safely delay revocation so mobile safari / PWA WebViews have time to complete write stream
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    window.URL.revokeObjectURL(objectUrl);
  }, revokeDelay);

  return objectUrl;
};

/**
 * Universal PDF export handler.
 * Automatically decides whether to preview, download, or offer share options.
 * 
 * @param {Blob|ArrayBuffer} rawData 
 * @param {string} fileName 
 * @param {object} [options={}]
 * @param {string} [options.title]
 * @param {boolean} [options.openPreview=false]
 * @param {boolean} [options.forceDownload=false]
 */
export const downloadOrPreviewPdf = (rawData, fileName = 'document.pdf', options = {}) => {
  const pdfBlob = ensurePdfBlob(rawData);
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const title = options.title || cleanName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );

  // Default to in-app Document Action Drawer / Modal preview unless caller explicitly specifies forceDownload: true
  if (!options.forceDownload) {
    triggerPdfPreview({ 
      blob: pdfBlob, 
      fileName: cleanName, 
      title,
      signedUrl: options.signedUrl || options.publicUrl || ''
    });
    return;
  }

  // Trigger standard reliable download if explicitly forced
  triggerDirectDownload(pdfBlob, cleanName);

  // Notify user with completion status toast
  triggerPushNotification(
    'PDF Download Started',
    `${cleanName} is downloading to storage.`,
    'success',
    null
  );
};
