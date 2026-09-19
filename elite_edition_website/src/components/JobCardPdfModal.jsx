import React, { useState, useEffect } from 'react';
import { X, Printer, Download, ExternalLink, Loader2, Image as ImageIcon, AlertCircle, FileText } from 'lucide-react';
import { api } from '../services/api';
import { triggerJobCardPrint } from './JobCardPanel';

export default function JobCardPdfModal({ card, loading, error, onClose, onNavigateToJobCards }) {
  const [resolvedImages, setResolvedImages] = useState({
    imageUrl1: card?.imageUrl1 || card?.imageUrl || card?.proofing?.artworkUrl || '',
    imageUrl2: card?.imageUrl2 || '',
  });
  const [fetchingImages, setFetchingImages] = useState(false);

  useEffect(() => {
    if (!card) return;
    let img1 = card.imageUrl1 || card.imageUrl || card.proofing?.artworkUrl || '';
    let img2 = card.imageUrl2 || '';

    if (!img1 && (card.designName || card.designNo)) {
      setFetchingImages(true);
      const rawName = String(card.designName || card.designNo);
      const parts = rawName.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
      const searchKey = parts[0] || rawName.trim();

      (api.getDesigns ? api.getDesigns({ search: searchKey, limit: 1 }) : api.getDesignCatalogue({ search: searchKey, limit: 1 }))
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.data || []);
          if (list.length > 0) {
            const matched = list[0];
            setResolvedImages({
              imageUrl1: matched.imageUrl || matched.imageUrl2 || '',
              imageUrl2: matched.imageUrl2 && matched.imageUrl !== matched.imageUrl2 ? matched.imageUrl2 : (parts.length > 1 ? card.imageUrl2 || '' : ''),
            });
          }
        })
        .catch(() => {})
        .finally(() => setFetchingImages(false));
    } else {
      setResolvedImages({ imageUrl1: img1, imageUrl2: img2 });
    }
  }, [card]);

  if (!card && !loading) return null;

  const handlePrint = () => {
    if (!card) return;
    triggerJobCardPrint({
      ...card,
      imageUrl1: resolvedImages.imageUrl1 || card.imageUrl1,
      imageUrl2: resolvedImages.imageUrl2 || card.imageUrl2,
    });
  };

  const handleDownload = async () => {
    if (!card) return;
    if (card._id) {
      try {
        await api.downloadJobCardPdf(card._id, card.jobNo || 'preview');
      } catch (err) {
        handlePrint();
      }
    } else {
      handlePrint();
    }
  };

  const machineBg = card?.machineName === 'GRANDO' ? '#0b5394' : card?.machineName === 'PRINTDOT' ? '#cc0000' : '#1e293b';

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '94vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          boxShadow: '0 25px 50px -12px rgba(30, 58, 138, 0.25), 0 0 0 1px rgba(191, 219, 254, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Top Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>
              <FileText size={18} color="#2563eb" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#1e3a8a' }}>
                  Job Card #{card?.jobNo || 'Preview'}
                </span>
                {card?.machineName && (
                  <span
                    style={{
                      background: machineBg,
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {card.machineName}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {card?.party || 'Elite Edition'} {card?.fabric ? `• ${card.fabric}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
              title="Print or Save as PDF"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Direct PDF Download"
            >
              <Download size={14} />
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Paper Layout */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600 }}>Loading Job Card PDF view...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>{error}</div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                Job Card #{card?.jobNo || ''} may not be found in active records.
              </p>
              {onNavigateToJobCards && (
                <button
                  onClick={onNavigateToJobCards}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Search in Job Cards Tab
                </button>
              )}
            </div>
          ) : (
            /* Physical Job Card Replica (Authentic White Sheet PDF Paper Layout) */
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                background: '#ffffff',
                color: '#000000',
                padding: '12px 14px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                boxSizing: 'border-box',
                borderRadius: '3px',
              }}
            >
              {/* Top Banner: Elite Digital Prints Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1.2px solid #000',
                  padding: '4px 8px',
                  marginBottom: '2px',
                  background: '#f8fafc',
                }}
              >
                <img
                  src="/DigitalLogo.png"
                  alt="Elite Digital Prints"
                  style={{ height: '30px', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11pt', fontWeight: 900, letterSpacing: '1px' }}>
                    ELITE DIGITAL PRINTS
                  </div>
                  <div
                    style={{
                      background: machineBg,
                      color: '#ffffff',
                      display: 'inline-block',
                      padding: '1px 12px',
                      fontSize: '9pt',
                      fontWeight: 800,
                      marginTop: '2px',
                      borderRadius: '2px',
                    }}
                  >
                    {card?.machineName || 'MACHINE'}
                  </div>
                </div>
                <img
                  src="/DigitalLogo.png"
                  alt="Elite Digital Prints"
                  style={{ height: '30px', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>

              {/* Specification Grid Table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '8pt',
                  marginTop: '1px',
                  border: '1.2px solid #000',
                }}
              >
                <tbody>
                  <tr>
                    <td style={tdLabel}>JOB NO. :</td>
                    <td style={{ ...tdVal, fontWeight: 900, fontSize: '9.5pt', color: '#0b5394' }}>{card?.jobNo || ''}</td>
                    <td style={tdLabel}>COLORS :</td>
                    <td style={tdVal}>{card?.colors || card?.colourMatching || ''}</td>
                    <td style={tdLabel}>DATE :</td>
                    <td style={tdVal}>{card?.date || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>D. NO. :</td>
                    <td style={{ ...tdVal, fontWeight: 800 }}>{card?.designNo || card?.designName || ''}</td>
                    <td style={tdLabel}>PANNA :</td>
                    <td style={tdVal}>{card?.panna || ''}</td>
                    <td style={tdLabel}>PASS :</td>
                    <td style={tdVal}>{card?.pass || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>FABRIC :</td>
                    <td style={{ ...tdVal, fontWeight: 700 }}>{card?.fabric || ''}</td>
                    <td style={tdLabel}>CON. :</td>
                    <td style={tdVal}>{card?.consumption || ''}</td>
                    <td style={tdLabel}>ALL OVER :</td>
                    <td style={tdVal}>{card?.allover || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>PCS :</td>
                    <td style={tdVal}>{card?.pcs || ''}</td>
                    <td style={tdLabel}>BOTTOM :</td>
                    <td style={tdVal}>{card?.bottom || ''}</td>
                    <td style={tdLabel}>PN/KM :</td>
                    <td style={tdVal}>{card?.pnKm || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>TOP :</td>
                    <td style={tdVal}>{card?.top || ''}</td>
                    <td style={tdLabel}>DUPATTA :</td>
                    <td style={tdVal}>{card?.dupatta || ''}</td>
                    <td style={tdLabel}>SET-COPY :</td>
                    <td style={tdVal}>{card?.setCopy || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>SLEEVE :</td>
                    <td style={tdVal}>{card?.sleeve || ''}</td>
                    <td style={tdLabel}>CUT :</td>
                    <td style={tdVal}>{card?.cut || ''}</td>
                    <td colSpan={2} style={{ ...tdVal, textAlign: 'center', background: '#f1f5f9', fontWeight: 800, fontSize: '8pt' }}>
                      TOTAL MTR
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>PARTY:</td>
                    <td colSpan={3} style={{ ...tdVal, fontWeight: 800, fontSize: '9pt' }}>
                      {card?.party || ''}
                    </td>
                    <td colSpan={2} style={{ ...tdVal, fontWeight: 900, fontSize: '10pt', paddingLeft: '8px', color: '#166534' }}>
                      : {card?.totalMtr || ''}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Design Image Area */}
              <div
                style={{
                  width: '100%',
                  border: '1.2px solid #000',
                  marginTop: '2px',
                  minHeight: '130px',
                  maxHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#f8fafc',
                }}
              >
                {resolvedImages.imageUrl1 || resolvedImages.imageUrl2 ? (
                  <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    {resolvedImages.imageUrl1 && (
                      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                        <img
                          src={resolvedImages.imageUrl1}
                          alt="Design 1"
                          style={{ maxWidth: '100%', maxHeight: '190px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    {resolvedImages.imageUrl2 && (
                      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderLeft: '1.2px solid #000' }}>
                        <img
                          src={resolvedImages.imageUrl2}
                          alt="Design 2"
                          style={{ maxWidth: '100%', maxHeight: '190px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                  </div>
                ) : fetchingImages ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '8pt' }}>
                    <Loader2 size={16} className="spin" />
                    <span>Resolving design artwork...</span>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '8pt' }}>
                    <ImageIcon size={22} style={{ margin: '0 auto 4px', opacity: 0.5 }} />
                    <div>{card?.designName || card?.designNo || 'No Design Image Attached'}</div>
                  </div>
                )}
              </div>

              {/* Notes Area */}
              <div
                style={{
                  border: '1.2px solid #000',
                  marginTop: '2px',
                  fontSize: '7.5pt',
                  fontWeight: 700,
                  lineHeight: '1.25',
                }}
              >
                <div style={{ padding: '2px 6px', borderBottom: '1px solid #e2e8f0' }}>
                  NOTE 1 : {card?.note1 || '—'}
                </div>
                {card?.emergencyNotes && (
                  <div style={{ padding: '2px 6px', background: '#fef2f2', color: '#b91c1c', borderBottom: '1px solid #fecaca' }}>
                    EMRG. NOTE : {card.emergencyNotes}
                  </div>
                )}
                <div style={{ padding: '2px 6px' }}>
                  NOTE 2 : {card?.note2 || '—'}
                </div>
              </div>

              {/* Bottom Specs Table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '7.5pt',
                  marginTop: '2px',
                  border: '1.2px solid #000',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ ...tdLabel, width: '18%' }}>DESIGNER :</td>
                    <td style={{ ...tdVal, width: '32%' }}>{card?.designer || ''}</td>
                    <td style={{ ...tdLabel, width: '18%' }}>C. M. :</td>
                    <td style={{ ...tdVal, width: '32%' }}>{card?.colourMatching || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>EXP. TIME :</td>
                    <td style={{ ...tdVal, fontWeight: 700, color: '#0b5394' }}>{card?.expTime || ''}</td>
                    <td style={tdLabel}>PAPER TYPE :</td>
                    <td style={tdVal}>{card?.paperType || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>PRINT DATE :</td>
                    <td style={tdVal}>{card?.printDate || ''}</td>
                    <td style={tdLabel}>PRINT METER :</td>
                    <td style={{ ...tdVal, fontWeight: 700 }}>{card?.printMtr || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>FUSING TEMP :</td>
                    <td style={tdVal}>{card?.temperature || ''}</td>
                    <td style={tdLabel}>SPEED :</td>
                    <td style={tdVal}>{card?.speed || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            gap: '8px',
          }}
        >
          {onNavigateToJobCards ? (
            <button
              onClick={onNavigateToJobCards}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
              }}
            >
              <ExternalLink size={12} />
              <span>Open in Job Cards Tab</span>
            </button>
          ) : <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const tdLabel = {
  border: '1px solid #000',
  padding: '2px 4px',
  fontWeight: 800,
  fontSize: '7.5pt',
  background: '#f8fafc',
  whiteSpace: 'nowrap',
};

const tdVal = {
  border: '1px solid #000',
  padding: '2px 4px',
  fontSize: '7.5pt',
};
