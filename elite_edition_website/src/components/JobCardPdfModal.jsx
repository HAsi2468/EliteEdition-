import React, { useState, useEffect } from 'react';
import { X, Printer, Download, ExternalLink, Loader2, Image as ImageIcon, AlertCircle, FileText } from 'lucide-react';
import { api } from '../services/api';
import { triggerJobCardPrint, JobCardQrBadge } from './JobCardPanel';
import DesignImage from './DesignImage';
import { buildTpAndWasteGrid } from '../utils/jobCardTpHelper';

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

  const [challans, setChallans] = useState(card?.challans || []);

  useEffect(() => {
    if (card?.challans && card.challans.length > 0) {
      setChallans(card.challans);
      return;
    }
    if (!card?.jobNo) return;
    let isMounted = true;
    const fetchChallans = async () => {
      try {
        const cleanNo = String(card.jobNo).replace(/^#?JOB\s*NO\.?\s*[-:]?\s*/i, '').replace(/^JC-/i, '').trim();
        const digits = cleanNo.match(/\d+/)?.[0];
        const res = await api.getFabricChallans({ search: digits || cleanNo, limit: 10 });
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (isMounted) setChallans(list);
      } catch (e) {
        console.warn('Error fetching challans in JobCardPdfModal:', e);
      }
    };
    fetchChallans();
    return () => { isMounted = false; };
  }, [card]);

  const { rows: tpRows, totalMtr: finalTpTotal, challanNosStr, challanDetailsList } = buildTpAndWasteGrid(challans, card);

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
                <JobCardQrBadge card={card} size={30} />
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
                      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', minHeight: '130px' }}>
                        <DesignImage
                          rawUrl={resolvedImages.imageUrl1}
                          designName={card?.designName || card?.designNo || ''}
                          thumbnail={true}
                          width={450}
                          style={{ width: '100%', height: '100%', maxHeight: '190px' }}
                          imgStyle={{ objectFit: 'contain' }}
                          showPlaceholderBadge={true}
                        />
                      </div>
                    )}
                    {resolvedImages.imageUrl2 && (
                      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderLeft: '1.2px solid #000', minHeight: '130px' }}>
                        <DesignImage
                          rawUrl={resolvedImages.imageUrl2}
                          designName={`${card?.designName || card?.designNo || ''}-2`}
                          thumbnail={true}
                          width={450}
                          style={{ width: '100%', height: '100%', maxHeight: '190px' }}
                          imgStyle={{ objectFit: 'contain' }}
                          showPlaceholderBadge={true}
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
                </tbody>
              </table>

              {/* Printing & Operator Table */}
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
                    <td style={{ ...tdLabel, width: '18%' }}>OPERATOR :</td>
                    <td style={{ ...tdVal, width: '32%' }}>{card?.operatorName || ''}</td>
                    <td style={{ ...tdLabel, width: '18%' }}>PRINT DATE :</td>
                    <td style={{ ...tdVal, width: '32%' }}>{card?.printDate || ''}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>ROLL NO. :</td>
                    <td style={tdVal}>{card?.rollNo || ''}</td>
                    <td style={tdLabel}>PRINT METER :</td>
                    <td style={{ ...tdVal, fontWeight: 800, color: '#2563eb' }}>{card?.printMtr ? `${card.printMtr} Mtr` : ''}</td>
                  </tr>
                </tbody>
              </table>

              {/* Fusing & Heat Press Table */}
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
                    <td style={{ ...tdLabel, width: '18%', textAlign: 'center', fontWeight: 900 }}>FUSING</td>
                    <td style={{ ...tdLabel, width: '14%' }}>TEMP. :</td>
                    <td style={{ ...tdVal, width: '18%', textAlign: 'center', fontWeight: 800 }}>{card?.fusingTemp || card?.temperature || ''}</td>
                    <td style={{ ...tdLabel, width: '14%' }}>SPEED :</td>
                    <td style={{ ...tdVal, width: '36%', textAlign: 'center', fontWeight: 800 }}>{card?.fusingSpeed || card?.speed || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdLabel, textAlign: 'center', fontWeight: 800 }}>NAME:</td>
                    <td style={tdVal} colSpan={2}>{card?.fusingOperator || ''}</td>
                    <td style={tdLabel}>DATE :</td>
                    <td style={tdVal}>{card?.fusingDate || ''}</td>
                  </tr>
                </tbody>
              </table>

              {/* T.P. METER & T.P. WASTAGE METER TABLE */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '7pt',
                  marginTop: '2px',
                  border: '1.2px solid #000',
                }}
              >
                <thead>
                  <tr>
                    <th colSpan={10} style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 900, background: '#f1f5f9', padding: '2px' }}>
                      T.P. METER
                    </th>
                    <th colSpan={2} style={{ border: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, lineHeight: 1.1, padding: '2px', background: '#fef2f2', textAlign: 'center' }}>
                      T.P. WASTAGE METER
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1 */}
                  <tr>
                    <td style={tdTpLabel}>1)</td><td style={tdTpVal}>{tpRows[0][0].val}</td>
                    <td style={tdTpLabel}>6)</td><td style={tdTpVal}>{tpRows[0][1].val}</td>
                    <td style={tdTpLabel}>11)</td><td style={tdTpVal}>{tpRows[0][2].val}</td>
                    <td style={tdTpLabel}>16)</td><td style={tdTpVal}>{tpRows[0][3].val}</td>
                    <td style={tdTpLabel}>20)</td><td style={tdTpVal}>{tpRows[0][4].val}</td>
                    <td style={{ ...tdTpLabel, background: '#fff1f2' }}>1)</td><td style={{ ...tdTpVal, background: '#fff1f2', color: '#b91c1c', fontWeight: 700 }}>{tpRows[0][5].wVal}</td>
                  </tr>
                  {/* Row 2 */}
                  <tr>
                    <td style={tdTpLabel}>2)</td><td style={tdTpVal}>{tpRows[1][0].val}</td>
                    <td style={tdTpLabel}>7)</td><td style={tdTpVal}>{tpRows[1][1].val}</td>
                    <td style={tdTpLabel}>12)</td><td style={tdTpVal}>{tpRows[1][2].val}</td>
                    <td style={tdTpLabel}>17)</td><td style={tdTpVal}>{tpRows[1][3].val}</td>
                    <td style={tdTpLabel}>21)</td><td style={tdTpVal}>{tpRows[1][4].val}</td>
                    <td style={{ ...tdTpLabel, background: '#fff1f2' }}>2)</td><td style={{ ...tdTpVal, background: '#fff1f2', color: '#b91c1c', fontWeight: 700 }}>{tpRows[1][5].wVal}</td>
                  </tr>
                  {/* Row 3 */}
                  <tr>
                    <td style={tdTpLabel}>3)</td><td style={tdTpVal}>{tpRows[2][0].val}</td>
                    <td style={tdTpLabel}>8)</td><td style={tdTpVal}>{tpRows[2][1].val}</td>
                    <td style={tdTpLabel}>13)</td><td style={tdTpVal}>{tpRows[2][2].val}</td>
                    <td style={tdTpLabel}>18)</td><td style={tdTpVal}>{tpRows[2][3].val}</td>
                    <td style={tdTpLabel}>22)</td><td style={tdTpVal}>{tpRows[2][4].val}</td>
                    <td style={{ ...tdTpLabel, background: '#fff1f2' }}>3)</td><td style={{ ...tdTpVal, background: '#fff1f2', color: '#b91c1c', fontWeight: 700 }}>{tpRows[2][5].wVal}</td>
                  </tr>
                  {/* Row 4 */}
                  <tr>
                    <td style={tdTpLabel}>4)</td><td style={tdTpVal}>{tpRows[3][0].val}</td>
                    <td style={tdTpLabel}>9)</td><td style={tdTpVal}>{tpRows[3][1].val}</td>
                    <td style={tdTpLabel}>14)</td><td style={tdTpVal}>{tpRows[3][2].val}</td>
                    <td style={tdTpLabel}>19)</td><td style={tdTpVal}>{tpRows[3][3].val}</td>
                    <td style={tdTpLabel}>23)</td><td style={tdTpVal}>{tpRows[3][4].val}</td>
                    <td style={{ ...tdTpLabel, background: '#f8fafc' }}>{tpRows[3][5].wLbl}</td><td style={{ ...tdTpVal, color: '#b91c1c', fontWeight: 700 }}>{tpRows[3][5].wVal}</td>
                  </tr>
                  {/* Row 5 */}
                  <tr>
                    <td style={tdTpLabel}>5)</td><td style={tdTpVal}>{tpRows[4][0].val}</td>
                    <td style={tdTpLabel}>10)</td><td style={tdTpVal}>{tpRows[4][1].val}</td>
                    <td style={tdTpLabel}>15)</td><td style={tdTpVal}>{tpRows[4][2].val}</td>
                    <td colSpan={3} style={{ border: '1px solid #000', fontWeight: 900, fontSize: '7.2pt', textAlign: 'right', paddingRight: '6px', background: '#f8fafc' }}>
                      TOTAL :-
                    </td>
                    <td style={{ ...tdTpVal, fontWeight: 900, color: '#1e3a8a' }}>{finalTpTotal}</td>
                    <td style={{ ...tdTpLabel, background: '#fef2f2', fontWeight: 800 }}>{(tpRows[4][5] || tpRows[4][3])?.wLbl}</td>
                    <td style={{ ...tdTpVal, background: '#fef2f2', color: '#b91c1c', fontWeight: 900 }}>{(tpRows[4][5] || tpRows[4][3])?.wVal}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ padding: '2px 4px', border: '1.2px solid #000', borderTop: 'none', fontSize: '6pt', color: '#334155', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1px', lineHeight: 1.25 }}>
                {challanDetailsList && challanDetailsList.length > 0 ? (
                  <div>
                    <strong>Challan:</strong>{' '}
                    {challanDetailsList.map((c, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {c.rawNo ? (
                          <a
                            href={`/verify/challan/${c.rawNo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0b5394', textDecoration: 'underline', fontWeight: 'bold' }}
                          >
                            {c.cNo}
                          </a>
                        ) : (
                          c.cNo
                        )}
                        {' ('}
                        {c.mtrStr ? `${c.mtrStr}, ` : ''}
                        {c.invoiceNo ? (
                          <>
                            Inv:{' '}
                            <a
                              href={`/verify/invoice/${encodeURIComponent(c.invoiceNo)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#0b5394', textDecoration: 'underline', fontWeight: 'bold' }}
                            >
                              {c.invoiceNo}
                            </a>
                          </>
                        ) : (
                          'Inv: --'
                        )}
                        {')'}
                      </span>
                    ))}
                  </div>
                ) : (
                  challanNosStr && <div><strong>Challan:</strong> {challanNosStr}</div>
                )}
                <div><strong>*Wastage:</strong> <strong>FF:</strong> Fabric Fault | <strong>PF:</strong> Print Fault | <strong>FS:</strong> Fusing Fault | <strong>GF:</strong> Genuine Fault | <strong>CW:</strong> Challan Waste | <strong>TOT:</strong> Total Wastage</div>
              </div>
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

const tdTpLabel = {
  border: '1px solid #000',
  padding: '2px 3px',
  fontWeight: 800,
  fontSize: '7pt',
  textAlign: 'center',
  background: '#f8fafc',
  width: '26px',
  color: '#000'
};

const tdTpVal = {
  border: '1px solid #000',
  padding: '2px 3px',
  fontSize: '7pt',
  width: '36px',
  minWidth: '32px',
  color: '#000'
};
