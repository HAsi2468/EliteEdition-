import React, { useState, useRef } from 'react';
import { X, UploadCloud, Camera, Image as ImageIcon, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';

export default function SignedDocumentUploadModal({
  isOpen,
  onClose,
  docType, // 'challan' | 'invoice'
  docId,
  docNumber,
  partyName,
  existingSignedCopy,
  onSuccess
}) {
  const [images, setImages] = useState([]); // Array of { file, previewUrl, remoteUrl }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');

    const availableSlots = 2 - images.length;
    if (availableSlots <= 0) {
      setError('Maximum 2 images allowed for signed document copy.');
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    const newImages = filesToAdd.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      remoteUrl: null
    }));

    setImages(prev => [...prev, ...newImages]);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    setImages(prev => {
      const copy = [...prev];
      if (copy[index]?.previewUrl && !copy[index]?.previewUrl.startsWith('http')) {
        URL.revokeObjectURL(copy[index].previewUrl);
      }
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      setError('Please select at least 1 image of the signed document.');
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
        'Upload Successful',
        `Signed ${docType === 'challan' ? 'Challan' : 'Invoice'} uploaded and submitted for Admin approval.`,
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
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
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
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          padding: '1.5rem',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
          color: 'var(--text-main, #f8fafc)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          style={{
            position: 'absolute',
            top: '1.1rem',
            right: '1.1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 8px',
                borderRadius: '6px',
                background: docType === 'challan' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: docType === 'challan' ? '#c084fc' : '#38bdf8',
                border: `1px solid ${docType === 'challan' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
              }}
            >
              {docType === 'challan' ? 'Challan' : 'Invoice'}
            </span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Upload Signed Copy
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
            {docNumber} {partyName ? `• ${partyName}` : ''}
          </p>
        </div>

        {/* Previous Rejection Alert if any */}
        {existingSignedCopy?.status === 'REJECTED' && existingSignedCopy?.rejectionReason && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: '#f87171'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Previous upload was rejected:</strong>
              <div style={{ marginTop: '2px' }}>{existingSignedCopy.rejectionReason}</div>
              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#fca5a5' }}>
                Please upload a clear, fully signed copy with legible stamp/signature.
              </div>
            </div>
          </div>
        )}

        {/* Instructions & R2 Badge */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed var(--border-color, #334155)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-muted, #94a3b8)'
          }}
        >
          <span>📸 Upload max <strong>2 images</strong> (Front / Back or Page 1 / 2)</span>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 600 }}>☁️ Cloudflare R2</span>
        </div>

        {/* Image Slots (Max 2) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[0, 1].map(index => {
            const img = images[index];
            return (
              <div
                key={index}
                style={{
                  height: '160px',
                  borderRadius: '12px',
                  border: img ? '1px solid #3b82f6' : '2px dashed var(--border-color, #334155)',
                  background: 'rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
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
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.65rem',
                        fontWeight: 700
                      }}
                    >
                      Image {index + 1}
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
                        background: 'rgba(239, 68, 68, 0.85)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
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
                      color: 'var(--text-muted, #94a3b8)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '1rem',
                      width: '100%',
                      height: '100%',
                      justifyContent: 'center'
                    }}
                  >
                    <Camera size={26} color="#60a5fa" />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                      {index === 0 ? '+ Upload Image 1' : '+ Upload Image 2'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {index === 0 ? '(Required)' : '(Optional / Back side)'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
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
          <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color, #334155)',
              color: 'var(--text-muted, #94a3b8)',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={uploading || images.length === 0}
            style={{
              background: images.length > 0 ? '#2563eb' : 'rgba(37, 99, 235, 0.4)',
              border: 'none',
              color: '#ffffff',
              padding: '0.6rem 1.4rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: images.length > 0 && !uploading ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: images.length > 0 ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
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
                Submit for Approval
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
