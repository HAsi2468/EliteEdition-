import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
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
  const socket = useSocket();
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

  // Real-time automatic updates via Socket.IO - no manual refresh needed!
  useEffect(() => {
    if (!socket) return;
    const handleSocketUpdate = () => {
      fetchDocuments();
    };
    socket.on('signed-document-updated', handleSocketUpdate);
    return () => {
      socket.off('signed-document-updated', handleSocketUpdate);
    };
  }, [socket, fetchDocuments]);

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
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bfdbfe'
              }}
            >
              <FileCheck size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Signed Documents Approval Queue
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Review and approve physical signed copies of Challans and Invoices.
              </p>
            </div>
          </div>
        </div>
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
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            gap: '4px'
          }}
        >
          {[
            { key: 'PENDING', label: 'Pending Review', count: stats.pending, color: '#d97706' },
            { key: 'APPROVED', label: 'Approved', count: stats.approved, color: '#059669' },
            { key: 'REJECTED', label: 'Rejected', count: stats.rejected, color: '#dc2626' },
            { key: 'ALL', label: 'All', count: stats.total, color: '#475569' }
          ].map(tab => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  background: active ? '#ffffff' : 'transparent',
                  border: active ? '1px solid #cbd5e1' : '1px solid transparent',
                  color: active ? '#1d4ed8' : '#64748b',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: active ? '#eff6ff' : '#e2e8f0',
                    color: active ? tab.color : '#64748b',
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
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              outline: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
              gap: '0.4rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search challan #, invoice #, party..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f172a',
                fontSize: '0.82rem',
                outline: 'none',
                width: '210px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {loading && documents.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <RotateCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block', color: '#2563eb' }} />
          Loading signed document queue...
        </div>
      ) : documents.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '16px',
            color: '#64748b'
          }}
        >
          <CheckCircle size={38} color="#059669" style={{ marginBottom: '0.75rem', opacity: 0.9 }} />
          <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: '#0f172a' }}>
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
                  background: '#ffffff',
                  border: isPending
                    ? '1.5px solid #f59e0b'
                    : isApproved
                    ? '1.5px solid #10b981'
                    : '1.5px solid #ef4444',
                  borderRadius: '14px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  position: 'relative',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.06)',
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
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: doc.docType === 'challan' ? '#f3e8ff' : '#e0f2fe',
                          color: doc.docType === 'challan' ? '#7e22ce' : '#0369a1',
                          border: `1px solid ${doc.docType === 'challan' ? '#d8b4fe' : '#bae6fd'}`
                        }}
                      >
                        {doc.docType}
                      </span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        {doc.docNumber}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
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
                        ? '#ecfdf5'
                        : isRejected
                        ? '#fef2f2'
                        : '#fffbeb',
                      color: isApproved ? '#059669' : isRejected ? '#dc2626' : '#d97706',
                      border: `1px solid ${
                        isApproved
                          ? '#a7f3d0'
                          : isRejected
                          ? '#fca5a5'
                          : '#fde68a'
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
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
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
                          border: '1px solid #cbd5e1'
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
                            background: 'rgba(15, 23, 42, 0.8)',
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
                    <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                      No image
                    </div>
                  )}
                </div>

                {/* Metadata details */}
                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>
                    👤 Uploaded by: <strong style={{ color: '#0f172a' }}>{signed.uploadedByName || 'Staff'}</strong>
                    {signed.uploadedAt && (
                      <span> • {new Date(signed.uploadedAt).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                  {doc.amountOrMtr && (
                    <div>
                      📦 Total: <strong style={{ color: '#2563eb' }}>{doc.amountOrMtr}</strong>
                    </div>
                  )}
                  {isRejected && signed.rejectionReason && (
                    <div style={{ color: '#dc2626', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <AlertCircle size={12} /> Reason: {signed.rejectionReason}
                    </div>
                  )}
                  {isApproved && signed.approvedByName && (
                    <div style={{ color: '#059669', marginTop: '2px', fontWeight: 600 }}>
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
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.75rem',
                    marginTop: 'auto'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
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
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        color: '#dc2626',
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
                        background: 'linear-gradient(135deg, #10b981, #059669)',
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
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setRejectPromptDoc(null)}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #ef4444',
              borderRadius: '14px',
              padding: '1.25rem',
              width: '100%',
              maxWidth: '420px',
              color: '#0f172a',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#dc2626', fontWeight: 800 }}>
              Reject Signed {rejectPromptDoc.docNumber}
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
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
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                color: '#0f172a',
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
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                style={{
                  background: '#dc2626',
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
