import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  Printer, 
  FileText, 
  ExternalLink,
  Maximize2,
  Minimize2,
  Check,
  Copy,
  Settings,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { 
  ensurePdfBlob, 
  canSharePdf, 
  sharePdf, 
  triggerDirectDownload 
} from '../utils/pdfDownloadService';
import { openPrintOptionsDialog, executeCleanPrint } from '../utils/printService';
import { triggerPushNotification } from './NotificationToast';

export default function PdfPreviewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('document.pdf');
  const [title, setTitle] = useState('PDF Preview');
  const [signedUrl, setSignedUrl] = useState('');
  const [isShareSupported, setIsShareSupported] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [paperSize, setPaperSize] = useState('A4'); // 'A4' | 'thermal-80'
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Swipe to dismiss tracking for mobile bottom drawer
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const currentYRef = useRef(0);

  const iframeRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePreviewRequest = (event) => {
      const detail = event.detail || {};
      const targetBlob = detail.blob ? ensurePdfBlob(detail.blob) : null;
      let url = detail.url || '';

      if (targetBlob) {
        url = window.URL.createObjectURL(targetBlob);
      }

      setBlob(targetBlob);
      setPreviewUrl(url);
      setFileName(detail.fileName || 'document.pdf');
      setTitle(detail.title || 'Document Preview');
      setSignedUrl(detail.signedUrl || detail.publicUrl || '');
      setIsShareSupported(canSharePdf(targetBlob, detail.fileName));
      setDragOffset(0);
      setIsOpen(true);
    };

    window.addEventListener('elite-pdf-preview', handlePreviewRequest);
    return () => {
      window.removeEventListener('elite-pdf-preview', handlePreviewRequest);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setDragOffset(0);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      setTimeout(() => {
        window.URL.revokeObjectURL(previewUrl);
      }, 1500);
    }
    setPreviewUrl('');
    setBlob(null);
  };

  const handleDownload = () => {
    if (blob) {
      triggerDirectDownload(blob, fileName);
    } else if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    triggerPushNotification(
      'Document Saved',
      `${fileName} has been saved to your downloads.`,
      'success'
    );
  };

  const handleShare = async () => {
    // 1. Try native Web Share API with File
    if (blob && navigator.share && canSharePdf(blob, fileName)) {
      const shared = await sharePdf(blob, fileName, title);
      if (shared) {
        triggerPushNotification('Shared Successfully', `${fileName} shared via device sheet.`, 'success');
        return;
      }
    }

    // 2. Fallback: Copy link to clipboard
    const shareableUrl = signedUrl || previewUrl || window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareableUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        triggerPushNotification(
          'Link Copied',
          'Document link copied to clipboard. Ready to paste.',
          'info'
        );
      } else {
        triggerPushNotification('Sharing', `Document link: ${shareableUrl}`, 'info');
      }
    } catch (err) {
      triggerPushNotification('Document Ready', `${fileName} ready for download.`, 'info');
    }
  };

  const handlePrint = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        triggerPushNotification('Print Sent', `Printing with ${paperSize === 'thermal-80' ? 'Thermal Roll (80mm)' : 'A4'} profile.`, 'info');
      } else if (previewUrl) {
        const printWindow = window.open(previewUrl, '_blank');
        if (printWindow) {
          printWindow.onload = () => printWindow.print();
        }
      }
    } catch (err) {
      console.warn('Iframe print restricted, opening standalone window:', err);
      if (previewUrl) {
        window.open(previewUrl, '_blank');
      }
    }
  };

  const handleOpenPrintOptions = () => {
    openPrintOptionsDialog({
      title,
      content: `<iframe src="${previewUrl}" style="width:100%;height:100%;border:none;"></iframe>`,
      defaultSettings: {
        paperSize: paperSize,
        orientation: 'portrait'
      }
    });
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // Touch Swipe-to-Dismiss handlers for mobile bottom drawer
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isMobile) return;
    const clientY = e.touches[0].clientY;
    currentYRef.current = clientY;
    const diff = clientY - touchStartYRef.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !isMobile) return;
    setIsDragging(false);
    const diff = currentYRef.current - touchStartYRef.current;
    if (diff > 120) {
      // Swiped down sufficiently - dismiss drawer
      handleClose();
    } else {
      // Snap back to top
      setDragOffset(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-fadeIn"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : isFullScreen ? '0' : '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="flex flex-col bg-white shadow-2xl overflow-hidden border border-slate-200 transition-transform"
        style={{
          width: isMobile ? '100%' : isFullScreen ? '100vw' : 'min(96vw, 1120px)',
          height: isMobile ? '92dvh' : isFullScreen ? '100vh' : 'min(92vh, 860px)',
          borderRadius: isMobile ? '20px 20px 0 0' : isFullScreen ? '0' : '14px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: isMobile ? 'none' : '1px solid #e2e8f0',
          overflow: 'hidden',
          transform: isMobile ? `translateY(${dragOffset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0
        }}
      >
        {/* Mobile Swipe Drag Handle */}
        {isMobile && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '100%',
              padding: '10px 0 6px',
              display: 'flex',
              justifyContent: 'center',
              cursor: 'grab',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #f1f5f9'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#cbd5e1',
                borderRadius: '999px'
              }}
            />
          </div>
        )}

        {/* Top Header & Document Action Bar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0.65rem 0.85rem' : '0.75rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            flexShrink: 0,
            gap: '0.5rem',
            flexWrap: isMobile ? 'wrap' : 'nowrap'
          }}
        >
          {/* Document Title & File Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileText size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 
                style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '0.92rem' : '1rem', 
                  fontWeight: 700, 
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {title}
              </h3>
              <p 
                style={{ 
                  margin: 0, 
                  fontSize: '0.72rem', 
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {fileName}
              </p>
            </div>
          </div>

          {/* Action Bar: Share | Print with Paper Size Toggle | Download */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            {/* Paper Size Toggle: A4 vs Thermal Roll */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '7px',
                padding: '2px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Select print paper size"
            >
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: paperSize === 'A4' ? '#2563eb' : 'transparent',
                  color: paperSize === 'A4' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('thermal-80')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: paperSize === 'thermal-80' ? '#2563eb' : 'transparent',
                  color: paperSize === 'thermal-80' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                Roll
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              title={`Print Document (${paperSize === 'thermal-80' ? 'Thermal Roll 80mm' : 'A4'})`}
            >
              <Printer size={15} color="#2563eb" />
              <span>Print</span>
            </button>

            {/* Print Advance Options Settings Icon */}
            <button
              onClick={handleOpenPrintOptions}
              style={{
                padding: '0.45rem',
                borderRadius: '7px',
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
              title="Print advance settings"
            >
              <SlidersHorizontal size={15} />
            </button>

            {/* Share Button (Web Share API or Copy Link fallback) */}
            <button
              onClick={handleShare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
              title="Share document directly via WhatsApp/Files or copy link"
            >
              {isCopied ? <Check size={15} color="#16a34a" /> : <Share2 size={15} color="#475569" />}
              <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Share'}</span>
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 700,
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
              }}
              title="Save PDF to device"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Download</span>
            </button>

            {!isMobile && (
              <>
                <button
                  onClick={handleOpenExternal}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '7px',
                    color: '#64748b',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                  title="Open in new tab"
                >
                  <ExternalLink size={15} />
                </button>

                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '7px',
                    color: '#64748b',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                  title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                >
                  {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </>
            )}

            <button
              onClick={handleClose}
              style={{
                padding: '0.45rem',
                borderRadius: '7px',
                color: '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '0.2rem'
              }}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div 
          style={{ 
            flex: 1, 
            backgroundColor: '#525659', 
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              src={`${previewUrl}#toolbar=1&navpanes=0`}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#525659'
              }}
            />
          ) : (
            <div style={{ color: '#ffffff', textAlign: 'center', padding: '2rem' }}>
              <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Preparing PDF document preview...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
