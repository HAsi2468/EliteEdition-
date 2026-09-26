import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ClipboardPaste,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';

export default function SignedDocumentUploadModal({
  isOpen,
  onClose,
  docType = 'invoice', // 'invoice' (primary) | 'challan'
  docId,
  docNumber,
  partyName,
  existingSignedCopy,
  onSuccess
}) {
  const [images, setImages] = useState([]); // Array of { file, previewUrl, remoteUrl }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [pasteNotice, setPasteNotice] = useState('');
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Common file processor for input, drag & drop, and clipboard paste
  const processFiles = useCallback((incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setError('');

    const validFiles = Array.from(incomingFiles).filter((f) => {
      return (
        (f.type && f.type.startsWith('image/')) ||
        /\.(jpe?g|png|webp|heic|bmp|gif|svg)$/i.test(f.name || '')
      );
    });

    if (validFiles.length === 0) {
      setError('Please select or paste valid image files (JPG, PNG, WEBP).');
      return;
    }

    setImages((prev) => {
      const availableSlots = 2 - prev.length;
      if (availableSlots <= 0) {
        setError('Maximum 2 images allowed for signed document copy. Remove an image first to replace it.');
        return prev;
      }

      const filesToAdd = validFiles.slice(0, availableSlots);
      const newEntries = filesToAdd.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        remoteUrl: null,
        name: file.name || 'signed-invoice-copy.png'
      }));

      return [...prev, ...newEntries];
    });

    // Reset native input so the same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Clipboard Paste (Ctrl+V / Cmd+V) Listener ──
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      // Do not intercept if user is typing into an input field or textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items || [];
      const imageFiles = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const file = new File(
              [blob],
              `signed_invoice_clipboard_${Date.now()}_${i + 1}.${ext}`,
              { type: blob.type }
            );
            imageFiles.push(file);
          }
        }
      }

      // Also check clipboardData.files fallback
      if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const f = clipboardData.files[i];
          if (f.type && f.type.startsWith('image/')) {
            imageFiles.push(f);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        processFiles(imageFiles);

        setPasteNotice(`✓ Pasted ${imageFiles.length} image(s) from clipboard!`);
        setTimeout(() => setPasteNotice(''), 3500);

        triggerPushNotification(
          'Image Pasted 📋',
          `Added ${imageFiles.length} image(s) from clipboard screenshot/copy.`,
          'info'
        );
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, processFiles]);

  if (!isOpen) return null;

  // ── Drag & Drop Handlers ──
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      processFiles(dt.files);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    processFiles(files);
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => {
      const copy = [...prev];
      if (copy[index]?.previewUrl && !copy[index]?.previewUrl.startsWith('http')) {
        URL.revokeObjectURL(copy[index].previewUrl);
      }
      copy.splice(index, 1);
      return copy;
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      setError('Please upload, drop, or paste at least 1 image of the signed invoice.');
      return;
    }

    if (images.length > 2) {
      setError('Maximum 2 images allowed.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // 1. Upload each image to Cloudflare R2
      const uploadedUrls = [];
      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        if (item.remoteUrl) {
          uploadedUrls.push(item.remoteUrl);
        } else if (item.file) {
          const res = await api.uploadSignedDocumentImage(item.file, docType);
          if (res && res.url) {
            uploadedUrls.push(res.url);
          } else {
            throw new Error(`Failed to upload Image ${i + 1} to Cloudflare R2.`);
          }
        }
      }

      // 2. Submit to backend signed document route
      const res = await api.uploadSignedDocument({
        docType,
        docId,
        images: uploadedUrls
      });

      triggerPushNotification(
        'Signed Copy Uploaded 🎉',
        `Signed ${docType === 'challan' ? 'Challan' : 'Invoice'} submitted successfully for Admin approval.`,
        'success'
      );

      if (onSuccess) onSuccess(res.signedCopy);
      onClose();
    } catch (err) {
      console.error('Failed to submit signed document:', err);
      setError(err.message || 'Failed to upload signed document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          padding: 0,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          color: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Full-Modal Drag & Drop Visual Overlay */}
        {isDragging && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(37, 99, 235, 0.94)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              zIndex: 50,
              border: '3px dashed #ffffff',
              borderRadius: '16px',
              animation: 'pulse 1.2s infinite'
            }}
          >
            <UploadCloud size={54} color="#ffffff" />
            <h3 style={{ margin: '1rem 0 0.3rem', fontSize: '1.25rem', fontWeight: 800 }}>
              Drop Signed Invoice Image Here
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#dbeafe' }}>
              Release to add {images.length === 0 ? 'Page 1' : 'Page 2'} (Supports PNG, JPG, WEBP)
            </p>
          </div>
        )}

        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '0.55rem',
                borderRadius: '10px',
                display: 'flex'
              }}
            >
              <UploadCloud size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff'
                  }}
                >
                  {docType === 'challan' ? 'Challan' : 'Tax Invoice'}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800 }}>
                  Upload Signed Copy
                </h3>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.92)' }}>
                {docNumber} {partyName ? `• ${partyName}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: 'none',
              color: '#ffffff',
              padding: '0.4rem',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Feature Announcement Bar: Drag & Drop + Copy-Paste */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.74rem',
            color: '#1e40af'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#2563eb" />
            <strong style={{ fontWeight: 800 }}>Quick Upload:</strong>
            <span>Drag &amp; Drop or press <strong>Ctrl+V / ⌘+V</strong> to paste screenshot</span>
          </div>
          {pasteNotice && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#16a34a',
                background: 'rgba(22, 163, 74, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}
            >
              {pasteNotice}
            </span>
          )}
        </div>

        <div style={{ padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Previous Rejection Alert if any */}
          {existingSignedCopy?.status === 'REJECTED' && existingSignedCopy?.rejectionReason && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.82rem',
                color: '#991b1b'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
              <div>
                <strong>Previous upload was rejected:</strong>
                <div style={{ marginTop: '2px' }}>{existingSignedCopy.rejectionReason}</div>
                <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#b91c1c' }}>
                  Please upload a clear, fully signed copy with legible stamp/signature.
                </div>
              </div>
            </div>
          )}

          {/* Image Slots (Max 2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
            {[0, 1].map((index) => {
              const img = images[index];
              return (
                <div
                  key={index}
                  style={{
                    height: '175px',
                    borderRadius: '12px',
                    border: img ? '2px solid #2563eb' : '2px dashed #93c5fd',
                    background: img ? '#f8fafc' : '#f0f7ff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    boxShadow: img ? '0 4px 12px rgba(37,99,235,0.1)' : 'none'
                  }}
                >
                  {img ? (
                    <>
                      <img
                        src={img.previewUrl}
                        alt={`Signed Copy ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          backdropFilter: 'blur(4px)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: 800
                        }}
                      >
                        Page {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        title="Remove image"
                        disabled={uploading}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.45)'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '1rem',
                        width: '100%',
                        height: '100%',
                        justifyContent: 'center'
                      }}
                    >
                      <div
                        style={{
                          background: '#dbeafe',
                          padding: '0.55rem',
                          borderRadius: '50%',
                          display: 'flex',
                          boxShadow: '0 2px 8px rgba(37,99,235,0.15)'
                        }}
                      >
                        <Camera size={24} color="#2563eb" />
                      </div>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af' }}>
                        {index === 0 ? '+ Add Page 1' : '+ Add Page 2'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {index === 0 ? '(Required front copy)' : '(Optional back side)'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}
                      >
                        Drop or Paste Here
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Upload Hints Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.25rem',
              padding: '0.5rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.72rem',
              color: '#475569'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UploadCloud size={14} color="#2563eb" />
              <span>Drag &amp; Drop Image</span>
            </div>
            <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ClipboardPaste size={14} color="#059669" />
              <span>Paste Clipboard (Ctrl+V)</span>
            </div>
            <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Camera size={14} color="#7c3aed" />
              <span>Browse / Camera</span>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Error Display */}
          {error && (
            <div
              style={{
                color: '#dc2626',
                fontSize: '0.82rem',
                textAlign: 'center',
                background: '#fef2f2',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #fca5a5',
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || images.length === 0}
              style={{
                background:
                  images.length > 0
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : '#93c5fd',
                border: 'none',
                color: '#ffffff',
                padding: '0.6rem 1.4rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: images.length > 0 && !uploading ? 'pointer' : 'not-allowed',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow:
                  images.length > 0 ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none'
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading to R2...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Submit for Admin Approval ({images.length}/2)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
