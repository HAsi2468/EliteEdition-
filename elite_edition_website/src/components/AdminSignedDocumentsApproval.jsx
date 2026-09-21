import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import SignedDocumentPreviewModal from './SignedDocumentPreviewModal';
import {
  FileCheck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RotateCw,
  ExternalLink,
  Eye,
  Filter,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

export default function AdminSignedDocumentsApproval() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING', 'APPROVED', 'REJECTED', 'ALL'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'challan', 'invoice'
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [rejectPromptDoc, setRejectPromptDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSignedDocumentApprovals({
        status: statusFilter,
        docType: typeFilter,
        search
      });
      if (res) {
        setDocuments(res.data || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load signed documents:', err);
      triggerPushNotification('Error', 'Failed to fetch signed documents approval queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 30000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleApprove = async (doc) => {
    setProcessingId(doc._id);
    try {
      await api.updateSignedDocumentApproval(doc.docType, doc._id, { action: 'APPROVED' });
      triggerPushNotification('Approved', `${doc.docNumber} has been approved.`, 'success');
      fetchDocuments();
    } catch (err) {
      console.error('Approval failed:', err);
      triggerPushNotification('Failed', err.message || 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectPromptDoc) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setProcessingId(rejectPromptDoc._id);
    try {
      await api.updateSignedDocumentApproval(rejectPromptDoc.docType, rejectPromptDoc._id, {
        action: 'REJECTED',
        rejectionReason: rejectionReason.trim()
      });
      triggerPushNotification('Rejected', `${rejectPromptDoc.docNumber} marked as rejected.`, 'info');
      setRejectPromptDoc(null);
      setRejectionReason('');
      fetchDocuments();
    } catch (err) {
      console.error('Rejection failed:', err);
      triggerPushNotification('Failed', err.message || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openPreview = (doc) => {
    setSelectedDoc(doc);
    setPreviewModalOpen(true);
  };

  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.2s ease-in' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileCheck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Signed Documents Approval Queue
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Review and approve physical signed copies of Challans and Invoices (stored in Cloudflare R2).
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDocuments}
          disabled={loading}
          style={{
            background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
            color: 'var(--text-main, #f8fafc)',
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* Status Filter Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            gap: '4px'
          }}
        >
          {[
            { key: 'PENDING', label: 'Pending Review', count: stats.pending, color: '#fbbf24' },
            { key: 'APPROVED', label: 'Approved', count: stats.approved, color: '#34d399' },
            { key: 'REJECTED', label: 'Rejected', count: stats.rejected, color: '#f87171' },
            { key: 'ALL', label: 'All', count: stats.total, color: '#94a3b8' }
          ].map(tab => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  background: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: active ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  color: active ? '#60a5fa' : 'var(--text-muted, #94a3b8)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: active ? tab.color : 'rgba(255,255,255,0.08)',
                    color: active ? '#000' : 'inherit',
                    fontWeight: 800
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* DocType select */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-main, #f8fafc)',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              outline: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="all">All Documents</option>
            <option value="challan">Challans Only</option>
            <option value="invoice">Invoices Only</option>
          </select>

          {/* Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              gap: '0.4rem',
              width: '240px'
            }}
          >
            <Search size={15} color="var(--text-muted, #94a3b8)" />
            <input
              type="text"
              placeholder="Search by party, number, staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.82rem',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
            <RotateCw size={24} color="#3b82f6" />
          </div>
          <div>Loading signed documents...</div>
        </div>
      ) : documents.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1rem',
            textAlign: 'center',
            background: 'var(--bg-secondary, rgba(255, 255, 255, 0.02))',
            border: '1px dashed var(--border-color, rgba(255, 255, 255, 0.1))',
            borderRadius: '16px',
            color: 'var(--text-muted, #94a3b8)'
          }}
        >
          <CheckCircle size={38} color="#10b981" style={{ marginBottom: '0.75rem', opacity: 0.8 }} />
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--text-main, #f8fafc)' }}>
            No documents in this queue
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            {statusFilter === 'PENDING'
              ? 'All signed documents have been verified and processed!'
              : 'No documents match the selected filters.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1rem'
          }}
        >
          {documents.map(doc => {
            const signed = doc.signedCopy || {};
            const images = signed.images || [];
            const isPending = signed.status === 'PENDING';
            const isApproved = signed.status === 'APPROVED';
            const isRejected = signed.status === 'REJECTED';

            return (
              <div
                key={doc._id}
                style={{
                  background: 'var(--card-bg, rgba(30, 41, 59, 0.7))',
                  border: isPending
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : isApproved
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '14px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  position: 'relative',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Card Top: Type, Number, Status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: doc.docType === 'challan' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: doc.docType === 'challan' ? '#c084fc' : '#38bdf8'
                        }}
                      >
                        {doc.docType}
                      </span>
                      <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                        {doc.docNumber}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                      {doc.partyName}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: isApproved
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isRejected
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: isApproved ? '#34d399' : isRejected ? '#f87171' : '#fbbf24',
                      border: `1px solid ${
                        isApproved
                          ? 'rgba(16, 185, 129, 0.3)'
                          : isRejected
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(245, 158, 11, 0.3)'
                      }`
                    }}
                  >
                    {isApproved && <CheckCircle size={12} />}
                    {isRejected && <XCircle size={12} />}
                    {isPending && <Clock size={12} />}
                    {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                  </span>
                </div>

                {/* Thumbnails (1 or 2 images) */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '6px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                  onClick={() => openPreview(doc)}
                  title="Click to zoom & inspect full resolution"
                >
                  {images.length > 0 ? (
                    images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: '95px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          position: 'relative',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <img
                          src={imgUrl}
                          alt={`Signed copy ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            right: '3px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: '#fff',
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 700
                          }}
                        >
                          Page {idx + 1}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.78rem' }}>
                      No image
                    </div>
                  )}
                </div>

                {/* Metadata details */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>
                    👤 Uploaded by: <strong style={{ color: 'var(--text-main, #f8fafc)' }}>{signed.uploadedByName || 'Staff'}</strong>
                    {signed.uploadedAt && (
                      <span> • {new Date(signed.uploadedAt).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                  {doc.amountOrMtr && (
                    <div>
                      📦 Total: <strong style={{ color: '#c084fc' }}>{doc.amountOrMtr}</strong>
                    </div>
                  )}
                  {isRejected && signed.rejectionReason && (
                    <div style={{ color: '#f87171', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <AlertCircle size={12} /> Reason: {signed.rejectionReason}
                    </div>
                  )}
                  {isApproved && signed.approvedByName && (
                    <div style={{ color: '#34d399', marginTop: '2px' }}>
                      ✓ Verified by {signed.approvedByName}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: '0.75rem',
                    marginTop: 'auto'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                      color: 'var(--text-main, #f8fafc)',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={13} /> Inspect
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={processingId === doc._id}
                      onClick={() => {
                        setRejectPromptDoc(doc);
                        setRejectionReason('');
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={processingId === doc._id}
                      onClick={() => handleApprove(doc)}
                      style={{
                        background: '#10b981',
                        border: 'none',
                        color: '#fff',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectPromptDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setRejectPromptDoc(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #ef4444',
              borderRadius: '14px',
              padding: '1.25rem',
              width: '100%',
              maxWidth: '420px',
              color: '#fff'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#f87171' }}>
              Reject Signed {rejectPromptDoc.docNumber}
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              Please specify the reason (e.g. Signature blurry, wrong page, stamp missing). The user will be notified to re-upload.
            </p>
            <input
              type="text"
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none',
                marginBottom: '1rem'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRejectPromptDoc(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: !rejectionReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewModalOpen && selectedDoc && (
        <SignedDocumentPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          documentData={selectedDoc}
          isAdmin={true}
          onStatusUpdated={() => fetchDocuments()}
        />
      )}
    </div>
  );
}
