import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Clock, ExternalLink, Download, User, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';

export default function SignedDocumentPreviewModal({
  isOpen,
  onClose,
  documentData, // { _id, docType, docNumber, partyName, date, signedCopy }
  isAdmin = false,
  onStatusUpdated
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen || !documentData) return null;

  const { _id, docType, docNumber, partyName, signedCopy } = documentData;
  const images = signedCopy?.images || [];
  const status = signedCopy?.status || 'NONE';

  const handleApprove = async () => {
    if (!isAdmin) return;
    setProcessing(true);
    try {
      await api.updateSignedDocumentApproval(docType, _id, { action: 'APPROVED' });
      triggerPushNotification('Document Approved', `${docNumber} signed copy approved.`, 'success');
      if (onStatusUpdated) onStatusUpdated(_id, 'APPROVED');
      onClose();
    } catch (err) {
      console.error('Approval failed:', err);
      triggerPushNotification('Approval Failed', err.message || 'Failed to approve document.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!isAdmin) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a reason for rejecting this document.');
      return;
    }
    setProcessing(true);
    try {
      await api.updateSignedDocumentApproval(docType, _id, {
        action: 'REJECTED',
        rejectionReason: rejectionReason.trim()
      });
      triggerPushNotification('Document Rejected', `${docNumber} signed copy marked as rejected.`, 'info');
      if (onStatusUpdated) onStatusUpdated(_id, 'REJECTED', rejectionReason.trim());
      onClose();
    } catch (err) {
      console.error('Rejection failed:', err);
      triggerPushNotification('Action Failed', err.message || 'Failed to reject document.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: 'var(--text-main, #f8fafc)',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: docType === 'challan' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                  color: docType === 'challan' ? '#c084fc' : '#38bdf8',
                  border: `1px solid ${docType === 'challan' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                }}
              >
                {docType === 'challan' ? 'Challan' : 'Invoice'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                {docNumber}
              </h3>
              {/* Status Pill */}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background:
                    status === 'APPROVED'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : status === 'REJECTED'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)',
                  color:
                    status === 'APPROVED'
                      ? '#34d399'
                      : status === 'REJECTED'
                      ? '#f87171'
                      : '#fbbf24',
                  border: `1px solid ${
                    status === 'APPROVED'
                      ? 'rgba(16, 185, 129, 0.4)'
                      : status === 'REJECTED'
                      ? 'rgba(239, 68, 68, 0.4)'
                      : 'rgba(245, 158, 11, 0.4)'
                  }`
                }}
              >
                {status === 'APPROVED' && <CheckCircle size={13} />}
                {status === 'REJECTED' && <XCircle size={13} />}
                {status === 'PENDING' && <Clock size={13} />}
                {status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending Approval'}
              </span>
            </div>
            {partyName && (
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                Party: <strong>{partyName}</strong>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {images[activeImageIdx] && (
              <a
                href={images[activeImageIdx]}
                target="_blank"
                rel="noreferrer"
                title="Open full resolution in new tab"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-muted, #94a3b8)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                <ExternalLink size={14} /> Full View
              </a>
            )}
            <button
              onClick={onClose}
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Multi-Image Switcher if 2 images uploaded */}
        {images.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.6rem 1.5rem',
              background: 'rgba(0, 0, 0, 0.25)',
              borderBottom: '1px solid var(--border-color, #1e293b)'
            }}
          >
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIdx(idx)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: activeImageIdx === idx ? '1px solid #3b82f6' : '1px solid transparent',
                  background: activeImageIdx === idx ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeImageIdx === idx ? '#60a5fa' : 'var(--text-muted, #94a3b8)',
                  transition: 'all 0.15s'
                }}
              >
                📄 Image {idx + 1} {idx === 0 ? '(Page 1 / Front)' : '(Page 2 / Back)'}
              </button>
            ))}
          </div>
        )}

        {/* Image Display Area */}
        <div
          style={{
            flex: 1,
            minHeight: '340px',
            maxHeight: '52vh',
            overflow: 'auto',
            background: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative'
          }}
        >
          {images[activeImageIdx] ? (
            <img
              src={images[activeImageIdx]}
              alt={`Signed Copy ${activeImageIdx + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
              No image available
            </div>
          )}
        </div>

        {/* Audit & Verification Metadata */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid var(--border-color, #1e293b)',
            fontSize: '0.78rem',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
            <span>
              👤 Uploaded by: <strong style={{ color: 'var(--text-main, #f8fafc)' }}>{signedCopy?.uploadedByName || 'Staff'}</strong>
            </span>
            {signedCopy?.uploadedAt && (
              <span>
                📅 Date: <strong style={{ color: 'var(--text-main, #f8fafc)' }}>{new Date(signedCopy.uploadedAt).toLocaleString('en-IN')}</strong>
              </span>
            )}
            {status === 'APPROVED' && signedCopy?.approvedByName && (
              <span style={{ color: '#34d399' }}>
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Approved by: <strong>{signedCopy.approvedByName}</strong>
              </span>
            )}
          </div>

          {/* Cloudflare R2 Source Pill */}
          <span style={{ fontSize: '0.7rem', color: '#38bdf8', opacity: 0.8 }}>
            ☁️ Stored in Cloudflare R2
          </span>
        </div>

        {/* Rejection Note Display if rejected */}
        {status === 'REJECTED' && signedCopy?.rejectionReason && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderTop: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span><strong>Rejection Reason:</strong> {signedCopy.rejectionReason}</span>
          </div>
        )}

        {/* Admin Action Bar */}
        {isAdmin && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color, #1e293b)',
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {showRejectInput ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Reason for rejecting (e.g. Signature blurry, wrong document, missing stamp)..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '0.55rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: processing || !rejectionReason.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color, #334155)',
                    color: 'var(--text-muted, #94a3b8)',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                  👑 <strong>Admin Controls:</strong> Verify signatures, dates, and stamps.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={processing}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      padding: '0.55rem 1.1rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={processing}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      padding: '0.55rem 1.3rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <CheckCircle size={15} /> Approve Signed Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
