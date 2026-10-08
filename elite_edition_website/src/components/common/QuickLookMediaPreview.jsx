import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, X, FileText, Image as ImageIcon, Copy, Check } from 'lucide-react';
import './QuickLookMediaPreview.css';

/**
 * QuickLookMediaPreview
 * 
 * Enterprise Quick-Look Modal Previewer.
 * Triggered on click, hover thumbnail, or pressing Spacebar on any record.
 * Supports:
 * - High-res images with zoom, rotate, download
 * - PDFs and document attachments
 * - Direct drag-and-drop replacement hook/component for table rows
 */
export function QuickLookMediaPreview({
  isOpen = false,
  onClose = () => {},
  fileUrl,
  fileName = 'Document Attachment',
  fileType = 'image', // 'image' | 'pdf' | 'other'
  fileSize,
  onReplaceFile = null
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // Reset transforms when opened
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setIsCopied(false);
    }
  }, [isOpen, fileUrl]);

  // Spacebar and Esc listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleCopyLink = () => {
    if (fileUrl) {
      navigator.clipboard?.writeText(fileUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!isOpen || !fileUrl) return null;

  const isPdf = fileType === 'pdf' || fileUrl.endsWith('.pdf');

  return (
    <div className="quicklook-modal-overlay" onClick={onClose}>
      <div className="quicklook-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="quicklook-header">
          <div className="quicklook-title-wrap">
            {isPdf ? <FileText size={18} color="#60a5fa" /> : <ImageIcon size={18} color="#60a5fa" />}
            <div>
              <h4 className="quicklook-file-title">{fileName}</h4>
              <p className="quicklook-file-meta">
                {fileType.toUpperCase()} {fileSize ? `• ${fileSize}` : ''} • Press Space or Esc to close
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="quicklook-toolbar">
            {!isPdf && (
              <>
                <button type="button" className="quicklook-btn" onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut size={16} />
                </button>
                <button type="button" className="quicklook-btn" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn size={16} />
                </button>
                <button type="button" className="quicklook-btn" onClick={handleRotate} title="Rotate 90°">
                  <RotateCw size={16} />
                </button>
              </>
            )}

            <button type="button" className="quicklook-btn" onClick={handleCopyLink} title="Copy File URL">
              {isCopied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
            </button>

            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="quicklook-btn"
              title="Download Original"
            >
              <Download size={16} />
            </a>

            <button type="button" className="quicklook-btn" onClick={onClose} title="Close Preview">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="quicklook-viewport">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title={fileName}
              className="quicklook-pdf-frame"
            />
          ) : (
            <img
              src={fileUrl}
              alt={fileName}
              className="quicklook-image"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * RowFileDropTarget
 * 
 * Wrapper component to turn any table row into a drag-and-drop replacement target.
 */
export function RowFileDropTarget({
  row,
  onFileDrop = () => {},
  children,
  className = '',
  style = {}
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      onFileDrop(row, droppedFile);
    }
  };

  return (
    <tr
      className={`row-dropzone-target ${isDragOver ? 'is-drag-active' : ''} ${className}`}
      style={style}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <td colSpan="100%" className="row-dropzone-badge">
          Release file to replace attachment for #{row.id || 'record'}
        </td>
      )}
      {!isDragOver && children}
    </tr>
  );
}
