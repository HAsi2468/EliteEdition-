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
        background: 'rgba(15, 23, 42, 0.75)',
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
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: 0,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            color: '#0f172a',
            position: 'relative',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
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
                    {docType === 'challan' ? 'Challan' : 'Invoice'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Upload Signed Copy
                  </h3>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                  {docNumber} {partyName ? `• ${partyName}` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#ffffff',
                padding: '0.4rem',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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
              {[0, 1].map(index => {
                const img = images[index];
                return (
                  <div
                    key={index}
                    style={{
                      height: '160px',
                      borderRadius: '12px',
                      border: img ? '2px solid #2563eb' : '2px dashed #93c5fd',
                      background: img ? '#f8fafc' : '#f0f7ff',
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
                            background: 'rgba(15, 23, 42, 0.8)',
                            color: '#ffffff',
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
                            background: '#ef4444',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
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
                          gap: '0.4rem',
                          padding: '1rem',
                          width: '100%',
                          height: '100%',
                          justifyContent: 'center'
                        }}
                      >
                        <div style={{ background: '#dbeafe', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
                          <Camera size={24} color="#2563eb" />
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                          {index === 0 ? '+ Upload Image 1' : '+ Upload Image 2'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
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
              <div style={{ color: '#dc2626', fontSize: '0.82rem', textAlign: 'center', background: '#fef2f2', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fca5a5' }}>
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
                  background: images.length > 0 ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#93c5fd',
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
                  boxShadow: images.length > 0 ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none'
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
      </div>
  );
}
