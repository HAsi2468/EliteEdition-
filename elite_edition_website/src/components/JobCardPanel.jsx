import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  PlusCircle, Search, RefreshCw, Edit2, Trash2, FileText,
  Printer, ChevronLeft, ChevronRight, Clock, CheckCircle,
  AlertCircle, Cpu, X, Save, Eye, Image, LayoutGrid, List, Send
} from 'lucide-react';
import DesignCatalogue from './DesignCatalogue';
import DesignMaster from './DesignMaster';
import JobCardTracking from './JobCardTracking';
import PrintSettings from './PrintSettings';
import ReportsCenter from './ReportsCenter';
import FabricInventoryPanel from './FabricInventoryPanel';
import RawMaterialsPanel from './RawMaterialsPanel';
import { COLOR_NAMES, getColorHex } from '../utils/colors';

// ─── EXP.TIME calculation (mirrors Apps Script exactly) ─────────────────────
const SPEED_GRANDO = {
  36:{1:281,2:168,4:101,6:67,8:50}, 38:{1:266,2:160,4:96,6:64,8:48},
  42:{1:240,2:144,4:86,6:58,8:43},  44:{1:230,2:138,4:82,6:55,8:41},
  46:{1:220,2:132,4:79,6:53,8:39},  58:{1:174,2:104,4:62,6:41,8:31},
};
const SPEED_PRINTDOT = {
  36:{1:841,2:503,4:299,6:198,8:150}, 38:{1:797,2:476,4:284,6:188,8:142},
  42:{1:721,2:431,4:257,6:170,8:129}, 44:{1:688,2:411,4:245,6:162,8:123},
  46:{1:658,2:393,4:234,6:155,8:117}, 58:{1:522,2:312,4:186,6:123,8:93},
};
function calcExpTime(panna, passText, totalMtr, machineName) {
  const pannaMatch = String(panna || '').match(/\d+/);
  const pannaNum = pannaMatch ? Number(pannaMatch[0]) : null;
  const passMatch = String(passText || '').match(/\d+/);
  const pass = passMatch ? Number(passMatch[0]) : null;
  if (!pannaNum || !pass || !totalMtr) return '';

  const mName = String(machineName || '').trim().toUpperCase();
  const table = mName === 'GRANDO' ? SPEED_GRANDO : mName === 'PRINTDOT' ? SPEED_PRINTDOT : null;
  if (!table || !table[pannaNum] || !table[pannaNum][pass]) return '';

  const speed = table[pannaNum][pass];
  const time = Number(totalMtr) / speed;
  let hours = Math.floor(time);
  let minutes = Math.round((time - hours) * 60);
  if (minutes === 60) { hours += 1; minutes = 0; }
  return `${hours}H & ${minutes}M`;
}

// ─── Google Drive URL auto-converter ─────────────────────────────────────────
// Accepts any Drive share / view / open link and returns a direct embeddable URL
function convertDriveUrl(link) {
  if (!link || !link.trim()) return '';
  if (link.startsWith('data:')) return link;
  
  // If it's a local relative path
  if (link.startsWith('/')) {
    const baseUrl = getBaseUrl();
    if (baseUrl && baseUrl.startsWith('http')) {
      try {
        const url = new URL(baseUrl);
        return `${url.origin}${link}`;
      } catch (e) {}
    }
    return link;
  }
  
  // If it's a Google Drive link
  if (link.includes('drive.google.com') || link.includes('googleusercontent') || link.includes('lh3.google')) {
    if (link.includes('uc?export') || link.includes('lh3.google') || link.includes('googleusercontent')) return link;
    const fileMatch = link.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
    const openMatch = link.match(/[?&]id=([-\w]{20,})/);
    if (openMatch) return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
    if (link.includes('/folders/')) return '';
    const idMatch = link.match(/([-\w]{25,})/);
    return idMatch ? `https://drive.google.com/uc?export=view&id=${idMatch[1]}` : link;
  }
  
  // If it's any other external link (e.g. starts with http)
  if (link.startsWith('http')) {
    return link;
  }
  
  // Fallback
  return link;
}

// ─── Blank form ──────────────────────────────────────────────────────────────
const BLANK = {
  jobNo:'', designNo:'', designName:'', category:'', fabric:'', pcs:'', top:'', sleeve:'',
  colors:'', panna:'', consumption:'', bottom:'', dupatta:'', cut:'',
  date: new Date().toISOString().split('T')[0],
  pass:'', allover:'', pnKm:'PN', setCopy:'', totalMtr:'', party:'',
  billTo:'', shipTo:'',
  expTime:'', designer:'', colourMatching:'', paperType:'',
  temperature:'', speed:'', profile:'', machineName:'',
  note1:'', note2:'', emergencyNotes:'', imageUrl1:'', imageUrl2:'',
  status:'Pending',
};

// ─── STATUS badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    Pending:     { bg:'rgba(245,158,11,0.12)',  color:'#fbbf24', border:'rgba(245,158,11,0.25)' },
    'In Progress':{ bg:'rgba(56,189,248,0.12)',  color:'#38bdf8', border:'rgba(56,189,248,0.25)' },
    Done:        { bg:'rgba(52,211,153,0.12)',   color:'#34d399', border:'rgba(52,211,153,0.25)' },
  };
  const s = cfg[status] || cfg['Pending'];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'0.2rem 0.6rem',
      fontSize:'0.7rem', fontWeight:700, borderRadius:'999px', textTransform:'uppercase',
      background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ─── Print / PDF template (matches the physical job card layout) ─────────────
function JobCardPrintView({ card, onClose, onShare }) {
  const printRef = useRef();
  const [resolvedImages, setResolvedImages] = useState({
    imageUrl1: card.imageUrl1 || '',
    imageUrl2: card.imageUrl2 || '',
  });

  useEffect(() => {
    const resolveImages = async () => {
      if (card.imageUrl1) return;
      const key = card.designName || card.designNo;
      if (!key) return;
      try {
        const res = await api.getDesigns({ search: key, limit: 5 });
        if (res && res.data && res.data.length > 0) {
          const matched = res.data.find(d => d.designName === key || d.designNo === key) || res.data[0];
          setResolvedImages({
            imageUrl1: matched.imageUrl || '',
            imageUrl2: matched.imageUrl2 || '',
          });
        }
      } catch (err) {
        console.error('Failed to resolve design images for print:', err);
      }
    };
    resolveImages();
  }, [card]);

  const doPrint = () => {
    // Convert Drive links to direct embeddable URLs for print
    const img1 = convertDriveUrl(resolvedImages.imageUrl1);
    const img2 = convertDriveUrl(resolvedImages.imageUrl2);

    
    // Dynamic image container layout based on existence of image 2
    let imgAreaHtml = '';
    if (img1 && img2) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; border-right: 1.2px solid #000; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img1}" style="max-width: 100%; max-height: 136px; object-fit: contain;" />
        </div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img2}" style="max-width: 100%; max-height: 136px; object-fit: contain;" />
        </div>
      </div>`;
    } else if (img1) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img1}" style="max-width: 100%; max-height: 136px; object-fit: contain;" />
        </div>
      </div>`;
    } else if (img2) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img2}" style="max-width: 100%; max-height: 136px; object-fit: contain;" />
        </div>
      </div>`;
    } else {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 2px;">
          <span style="color:#ccc; font-size: 10pt; font-weight: bold;">NO DESIGN IMAGE</span>
        </div>
      </div>`;
    }

    const win = window.open('', '_blank', 'width=600,height=800');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Job Card ${card.jobNo}</title>
      <style>
        @page { size: A5; margin: 8mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
        body { background: #fff; color: #000; font-size: 9pt; line-height: 1.2; position: relative; padding-left: 12mm; }
        .wrap { width: 100%; display: flex; flex-direction: column; gap: 1px; }
        
        /* Header styles */
        .header { display: flex; align-items: stretch; border: 1.5px solid #000; height: 44px; margin-bottom: 1px; }
        .logo-box {
          width: 140px;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1.5px solid #000;
        }
        .logo-box-right {
          width: 140px;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-left: 1.5px solid #000;
        }
        .center-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2px 0;
          text-align: center;
        }
        .center-title {
          font-size: 15.5pt;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #000;
          text-transform: uppercase;
        }
        .machine-box {
          width: 90%;
          border: 1px solid #000;
          font-size: 9pt;
          font-weight: 900;
          letter-spacing: 1.5px;
          padding: 1px 0;
          margin-top: 1px;
          text-transform: uppercase;
          text-align: center;
          background: ${card.machineName === 'GRANDO' ? '#0b5394' : card.machineName === 'PRINTDOT' ? '#cc0000' : '#fff'};
          color: ${card.machineName ? '#fff' : '#000'};
        }

        /* Tables */
        table { width: 100%; border-collapse: collapse; margin-top: 1px; }
        td, th { border: 1.2px solid #000; padding: 3px 5px; font-size: 9pt; vertical-align: middle; }
        .label { font-weight: 800; white-space: nowrap; width: 1%; background: #fff; }
        .val { font-weight: 500; }

        /* Notes Section */
        .notes-container {
          width: 100%;
          border-left: 1.2px solid #000;
          border-right: 1.2px solid #000;
          margin-top: 1px;
        }
        .note-row {
          background: #f3f3f3;
          border-bottom: 1.2px solid #000;
          padding: 3px 6px;
          font-size: 9pt;
          font-weight: 700;
          min-height: 18px;
        }
        .note-row-emergency {
          background: #f3f3f3;
          border-bottom: 1.2px solid #000;
          padding: 3px 6px;
          font-size: 9pt;
          font-weight: 700;
          color: #cc0000;
          min-height: 18px;
        }

        /* T.P. Meter styles */
        .tp-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
        .tp-table td { text-align: center; padding: 2px 4px; font-size: 8.5pt; border: 1.2px solid #000; height: 26px; }
        .tp-table th { font-size: 9pt; font-weight: 800; border: 1.2px solid #000; background: #fff; padding: 3px; }
        .tp-label { font-weight: 700; width: 1%; white-space: nowrap; }
        .tp-val { width: 14%; }
        .tp-val { width: 14%; }

        /* Punch Guide */
        .punch-guide {
          position: absolute;
          left: 2mm;
          top: 90mm; /* Center of A5 height relative to top of body */
          width: 8mm;
          z-index: 100;
        }
        .punch-hole {
          position: absolute;
          left: 1mm;
          width: 6mm;
          height: 6mm;
          border: 1px solid #9ca3af;
          border-radius: 50%;
          box-sizing: border-box;
        }
        .punch-hole.top { top: -43mm; }
        .punch-hole.bottom { top: 37mm; }
        .punch-center {
          position: absolute;
          top: 0;
          left: 0;
          width: 10mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateY(-50%);
        }
        .punch-text {
          font-size: 5pt;
          color: #9ca3af;
          margin-top: 2px;
        }
      </style>
    </head><body>
      <!-- PUNCH GUIDE -->
      <div class="punch-guide">
        <div class="punch-hole top"></div>
        <div class="punch-center">
          <svg width="10" height="8" viewBox="0 0 10 8">
            <line x1="0" y1="4" x2="10" y2="4" stroke="#9ca3af" stroke-width="1.5"/>
            <polyline points="7,1 10,4 7,7" fill="none" stroke="#9ca3af" stroke-width="1.5"/>
          </svg>
          <div class="punch-text">PUNCH</div>
        </div>
        <div class="punch-hole bottom"></div>
      </div>
      
      <div class="wrap">
      <!-- HEADER -->
      <div class="header">
        <div class="logo-box">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="18" height="26" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
              <rect width="22" height="30" rx="10" fill="black"/>
              <path d="M11 6C7.5 6 5 8.5 5 12C5 15.5 7.5 18 11 18C13 18 15 16.5 15 15C15 13.5 13.5 13 12 13C10.5 13 9.5 14 9.5 15C9.5 16 10.5 16.5 11 16.5C11.5 16.5 12 16 12 15.5H13.5C13.5 17 12 18 10 18C7.5 18 6.5 15.5 6.5 13C6.5 10.5 8 7.5 11 7.5C14 7.5 15.5 10.5 15.5 13C15.5 14.5 14.5 15.5 13.5 16L14.5 17.5C16 16.5 17 15 17 13C17 8.5 14.5 6 11 6Z" fill="white"/>
            </svg>
            <div style="text-align: left; line-height: 1.1;">
              <div style="font-size: 15.5pt; font-weight: 900; letter-spacing: -0.5px; color: #000;">ELITE</div>
              <div style="font-size: 6.5pt; font-weight: 800; letter-spacing: 2px; color: #000; margin-top: -1px;">EDITION</div>
            </div>
          </div>
        </div>
        <div class="center-box">
          <div class="center-title">ELITE DIGITAL</div>
          <div class="machine-box">${card.machineName || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</div>
        </div>
        <div class="logo-box-right">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="18" height="26" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
              <rect width="22" height="30" rx="10" fill="black"/>
              <path d="M11 6C7.5 6 5 8.5 5 12C5 15.5 7.5 18 11 18C13 18 15 16.5 15 15C15 13.5 13.5 13 12 13C10.5 13 9.5 14 9.5 15C9.5 16 10.5 16.5 11 16.5C11.5 16.5 12 16 12 15.5H13.5C13.5 17 12 18 10 18C7.5 18 6.5 15.5 6.5 13C6.5 10.5 8 7.5 11 7.5C14 7.5 15.5 10.5 15.5 13C15.5 14.5 14.5 15.5 13.5 16L14.5 17.5C16 16.5 17 15 17 13C17 8.5 14.5 6 11 6Z" fill="white"/>
            </svg>
            <div style="text-align: left; line-height: 1.1;">
              <div style="font-size: 15.5pt; font-weight: 900; letter-spacing: -0.5px; color: #000;">ELITE</div>
              <div style="font-size: 6.5pt; font-weight: 800; letter-spacing: 2px; color: #000; margin-top: -1px;">EDITION</div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN FIELDS TABLE -->
      <table style="margin-top:1px">
        <tr>
          <td class="label">JOB NO. :</td><td class="val">${card.jobNo || ''}</td>
          <td class="label">COLORS :</td><td class="val">${card.colors || ''}</td>
          <td class="label">DATE :</td><td class="val">${card.date || ''}</td>
        </tr>
        <tr>
          <td class="label">D. NO. :</td><td class="val">${card.designNo || ''}</td>
          <td class="label">PANNA :</td><td class="val">${card.panna || ''}</td>
          <td class="label">PASS :</td><td class="val">${card.pass || ''}</td>
        </tr>
        <tr>
          <td class="label">FABRIC :</td><td class="val">${card.fabric || ''}</td>
          <td class="label">CON. :</td><td class="val">${card.consumption || ''}</td>
          <td class="label">ALL OVER :</td><td class="val">${card.allover || ''}</td>
        </tr>
        <tr>
          <td class="label">PCS :</td><td class="val">${card.pcs || ''}</td>
          <td class="label">BOTTOM :</td><td class="val">${card.bottom || ''}</td>
          <td class="label">PN/KM :</td><td class="val">${card.pnKm || ''}</td>
        </tr>
        <tr>
          <td class="label">TOP :</td><td class="val">${card.top || ''}</td>
          <td class="label">DUPATTA :</td><td class="val">${card.dupatta || ''}</td>
          <td class="label">SET-COPY :</td><td class="val">${card.setCopy || ''}</td>
        </tr>
        <tr>
          <td class="label">SLEEVE :</td><td class="val">${card.sleeve || ''}</td>
          <td class="label">CUT :</td><td class="val">${card.cut || ''}</td>
          <td colspan="2" style="text-align: center; font-weight: 800; background: #fff;">TOTAL MTR</td>
        </tr>
        <tr>
          <td class="label">PARTY:</td><td colspan="3" class="val">${card.party || ''}</td>
          <td colspan="2" style="font-weight: 900; font-size: 11.5pt; padding-left: 10px;">: ${card.totalMtr || ''}</td>
        </tr>
      </table>

      <!-- IMAGE AREA CONTAINER (Side-by-side or Single) -->
      ${imgAreaHtml}


      <!-- NOTES CONTAINER (Three stripes) -->
      <div class="notes-container">
        <div class="note-row">NOTE 1 : ${card.note1 || ''}</div>
        <div class="note-row-emergency">EMRG. NOTE : ${card.emergencyNotes || ''}</div>
        <div class="note-row">NOTE 2 : ${card.note2 || ''}</div>
      </div>

      <!-- DETAILS TABLE 1 -->
      <table style="width: 100%; margin-top: 1px;">
        <tr>
          <td class="label" style="width: 15%;">DESIGNER :</td>
          <td class="val" style="width: 35%;">${card.designer || ''}</td>
          <td class="label" style="width: 15%;">C. M.:</td>
          <td class="val" style="width: 35%;">${card.colourMatching || ''}</td>
        </tr>
        <tr>
          <td class="label">EXP. TIME :</td>
          <td class="val">${card.expTime || ''}</td>
          <td class="label">PAPER TYPE :</td>
          <td class="val">${card.paperType || ''}</td>
        </tr>
      </table>

      <!-- DETAILS TABLE 2 (OPERATOR) -->
      <table style="width: 100%; margin-top: 1px;">
        <tr>
          <td class="label" style="width: 15%;">OPERATER:</td>
          <td class="val" style="width: 35%;"></td>
          <td class="label" style="width: 15%;">PRINT DATE :</td>
          <td class="val" style="width: 35%;"></td>
        </tr>
        <tr>
          <td class="label">ROLL NO. :</td>
          <td class="val"></td>
          <td class="label">PRINT METER :</td>
          <td class="val"></td>
        </tr>
      </table>

      <!-- DETAILS TABLE 3 (FUSING) -->
      <table style="width: 100%; margin-top: 1px;">
        <tr>
          <td class="label" style="width: 15%; text-align: center; font-weight: 800;">FUSING</td>
          <td class="label" style="width: 15%;">TEMP. :</td>
          <td class="val" style="width: 20%; text-align: center; font-weight: 800;">${card.temperature || ''}</td>
          <td class="label" style="width: 15%;">SPEED :</td>
          <td class="val" style="width: 35%; text-align: center; font-weight: 800;">${card.speed || ''}</td>
        </tr>
        <tr>
          <td class="label" style="text-align: center; font-weight: 800;">NAME:</td>
          <td class="val" colspan="2"></td>
          <td class="label">DATE :</td>
          <td class="val"></td>
        </tr>
      </table>

      <!-- T.P. METER TABLE -->
      <table class="tp-table">
        <tr>
          <th colspan="10" style="text-align: center; font-weight: 800;">T.P. METER</th>
          <th colspan="2" style="font-size: 6.5pt; font-weight: 800; line-height: 1.1; padding: 2px;">T.P.<br/>WESTAGE<br/>METER</th>
        </tr>
        <tr>
          <td class="tp-label">1)</td><td class="tp-val"></td>
          <td class="tp-label">6)</td><td class="tp-val"></td>
          <td class="tp-label">11)</td><td class="tp-val"></td>
          <td class="tp-label">16)</td><td class="tp-val"></td>
          <td class="tp-label">20)</td><td class="tp-val"></td>
          <td class="tp-label" style="width: 25px;">1)</td><td class="tp-val"></td>
        </tr>
        <tr>
          <td class="tp-label">2)</td><td class="tp-val"></td>
          <td class="tp-label">7)</td><td class="tp-val"></td>
          <td class="tp-label">12)</td><td class="tp-val"></td>
          <td class="tp-label">17)</td><td class="tp-val"></td>
          <td class="tp-label">21)</td><td class="tp-val"></td>
          <td class="tp-label">2)</td><td class="tp-val"></td>
        </tr>
        <tr>
          <td class="tp-label">3)</td><td class="tp-val"></td>
          <td class="tp-label">8)</td><td class="tp-val"></td>
          <td class="tp-label">13)</td><td class="tp-val"></td>
          <td class="tp-label">18)</td><td class="tp-val"></td>
          <td class="tp-label">22)</td><td class="tp-val"></td>
          <td class="tp-label">3)</td><td class="tp-val"></td>
        </tr>
        <tr>
          <td class="tp-label">4)</td><td class="tp-val"></td>
          <td class="tp-label">9)</td><td class="tp-val"></td>
          <td class="tp-label">14)</td><td class="tp-val"></td>
          <td class="tp-label">19)</td><td class="tp-val"></td>
          <td class="tp-label">23)</td><td class="tp-val"></td>
          <td class="tp-label"></td><td class="tp-val"></td>
        </tr>
        <tr>
          <td class="tp-label">5)</td><td class="tp-val"></td>
          <td class="tp-label">10)</td><td class="tp-val"></td>
          <td class="tp-label">15)</td><td class="tp-val"></td>
          <td colspan="3" style="font-weight: 800; font-size: 7.2pt; text-align: right; padding-right: 5px;">TOTAL :-</td><td class="tp-val"></td>
          <td class="tp-label"></td><td class="tp-val"></td>
        </tr>
      </table>
    </div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth:520, padding:'1.5rem' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem' }}>
          <div>
            <h3 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text-primary)' }}>Job Card Preview</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:2 }}>Job No.: {card.jobNo} • Machine: {card.machineName || '—'}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={16}/></button>
        </div>

        {/* Quick summary */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'1.2rem' }}>
          {[
            ['Party', card.party],
            ['Design Name', card.designName || card.designNo],
            ['Fabric', card.fabric],
            ['Designer', card.designer],
            ['C. Matching', card.colourMatching],
            ['Panna', card.panna],
            ['Pass', card.pass],
            ['Total Mtr', card.totalMtr],
            ['EXP. Time', card.expTime],
            ['Fusing Temp', card.temperature],
            ['Speed', card.speed],
            ['Date', card.date],
          ].map(([k,v])=>(
            <div key={k} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-light)',
              borderRadius:'var(--radius-sm)', padding:'0.5rem 0.75rem' }}>
              <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700 }}>{k}</div>
              <div style={{ fontSize:'0.9rem', color: k==='EXP. Time'||k==='Design Name' ? 'var(--primary)' : 'var(--text-primary)', fontWeight:600 }}>{v || '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={doPrint}>
            <Printer size={15}/> Print / PDF
          </button>
          {onShare && (
            <button className="btn-secondary" style={{ flex:1, justifyContent:'center', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }} onClick={() => onShare(card)}>
              <Send size={15}/> Share to Chat
            </button>
          )}
          <button className="btn-secondary" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form field helper ───────────────────────────────────────────────────────
function Field({ label, name, form, onChange, type='text', options, half, readOnly, highlight }) {
  const showColorPreview = name === 'colors' && getColorHex(form[name]);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flex: half ? '0 0 calc(50% - 0.4rem)' : '1 1 auto', minWidth:120 }}>
      <label style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
          {type === 'select' ? (
            <select
              name={name}
              value={form[name]}
              onChange={onChange}
              disabled={readOnly}
              style={{ padding:'0.5rem 0.7rem', fontSize:'0.85rem', width: '100%',
                background: readOnly ? 'rgba(56,189,248,0.04)' : undefined }}
            >
              {options && options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : options ? (
            <>
              <input 
                type={type} 
                name={name} 
                value={form[name]} 
                onChange={onChange} 
                list={`${name}-options`}
                readOnly={readOnly}
                placeholder="Select or type..."
                style={{ padding:'0.5rem 0.7rem', fontSize:'0.85rem', width: '100%' }} 
              />
              <datalist id={`${name}-options`}>
                {options.filter(o => o).map(o => <option key={o} value={o} />)}
              </datalist>
            </>
          ) : (
            <input type={type} name={name} value={form[name]} onChange={onChange} readOnly={readOnly}
              style={{ padding:'0.5rem 0.7rem', fontSize:'0.85rem', width: '100%',
                borderColor: highlight ? 'var(--primary)' : undefined,
                background: readOnly ? 'rgba(56,189,248,0.04)' : undefined,
                color: highlight ? 'var(--primary)' : undefined,
                fontWeight: highlight ? 700 : 500 }} />
          )}
        </div>
        {showColorPreview && (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: getColorHex(form[name]),
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }} title={form[name]} />
        )}
      </div>
    </div>
  );
}

// ─── Image compression utility ────────────────────────────────────────────────
function compressAndConvertToBase64(file, maxWidth = 900, maxHeight = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// ─── Image URL field with live Drive preview / direct upload ──────────────────
function ImageField({ label, name, form, onChange, index }) {
  const raw = form[name] || '';
  const [mode, setMode] = useState(raw && !raw.startsWith('data:') ? 'url' : 'file'); // 'file' or 'url'
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressAndConvertToBase64(file);
      onChange({ target: { name, value: base64 } });
    } catch (err) {
      alert('Failed to process image file: ' + err.message);
    }
  };

  const handleClear = () => {
    onChange({ target: { name, value: '' } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isBase64 = raw.startsWith('data:');
  const previewUrl = isBase64 ? raw : convertDriveUrl(raw);
  const isDriveFolder = raw.includes('/folders/');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 auto', minWidth: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => {
            setMode(m => m === 'file' ? 'url' : 'file');
            handleClear();
          }}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
        >
          {mode === 'file' ? 'Paste URL instead' : 'Upload File instead'}
        </button>
      </div>

      {mode === 'file' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              try {
                const base64 = await compressAndConvertToBase64(file);
                onChange({ target: { name, value: base64 } });
              } catch (err) {
                alert('Failed to process image file: ' + err.message);
              }
            }
          }}
          style={{
            border: '2px dashed var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.01)',
            transition: 'border-color 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            minHeight: '120px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          {previewUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={previewUrl}
                alt={`Selected preview ${index}`}
                style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  position: 'absolute', top: -8, right: -8,
                  background: 'var(--danger)', color: 'var(--text-primary)', border: 'none',
                  borderRadius: '50%', width: '18px', height: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <Image size={20} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Drag & Drop or <strong style={{ color: 'var(--primary)' }}>Browse</strong> to upload
              </span>
            </>
          )}
        </div>
      ) : (
        <>
          <input
            type="text" name={name} value={raw} onChange={onChange}
            placeholder="Paste Google Drive share link or direct image URL…"
            style={{ padding: '0.5rem 0.7rem', fontSize: '0.82rem', fontWeight: 500,
              borderColor: previewUrl ? 'rgba(52,211,153,0.4)' : undefined }}
          />

          {isDriveFolder && (
            <div style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              ⚠️ This is a <strong>folder</strong> link — open Drive, right-click an <strong>individual image file</strong> → Share → Copy link
            </div>
          )}
          {raw && !isDriveFolder && !previewUrl && (
            <div style={{ fontSize: '0.72rem', color: '#f87171' }}>⚠️ Could not parse as a Drive link. Paste the file share URL.</div>
          )}

          {previewUrl && (
            <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.03)',
              padding: '0.4rem', textAlign: 'center', position: 'relative' }}>
              <img
                src={previewUrl}
                alt={`Image ${index} preview`}
                style={{ maxWidth: '100%', maxHeight: 130, objectFit: 'contain', borderRadius: 4, display: 'block', margin: '0 auto' }}
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <span>🔒 Preview blocked by Drive CORS</span>
                <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Image will appear correctly in the printed PDF</span>
              </div>
              <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.6rem',
                background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '1px 5px',
                borderRadius: 4, fontWeight: 700 }}>✓ URL OK</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── JOB CARD FORM MODAL ─────────────────────────────────────────────────────
function JobCardForm({ card, onSave, onClose }) {
  const [form, setForm] = useState(card ? { ...card } : { ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Autofill from Design Catalogue states
  const [designsList, setDesignsList] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Dropdown options loaded from backend Print Settings
  const [printConfig, setPrintConfig] = useState({
    categories: [], passes: [], parties: [], widths: []
  });

  const suggestionsRef = useRef(null);

  useEffect(() => {
    // Fetch dynamic print settings
    const fetchConfig = async () => {
      try {
        const cfg = await api.getPrintConfig();
        setPrintConfig(cfg);
      } catch (err) {
        console.error('Failed to load print settings:', err);
      }
    };
    fetchConfig();

    const fetchAllDesigns = async () => {
      try {
        const res = await api.getDesigns({ limit: 100 });
        if (res && res.data) {
          setDesignsList(res.data);
        }
      } catch (err) {
        console.error('Failed to load designs list for autofill:', err);
      }
    };
    fetchAllDesigns();

    if (!card) {
      const fetchNextNo = async () => {
        try {
          const res = await api.getNextJobCardNo();
          if (res && res.nextJobNo) {
            setForm(f => ({ ...f, jobNo: String(res.nextJobNo) }));
          }
        } catch (err) {
          console.error('Failed to fetch next job number:', err);
        }
      };
      fetchNextNo();
    }
  }, [card]);

  // Sync selectedDesign if editing an existing card
  useEffect(() => {
    if (card && card.designName && designsList.length > 0) {
      const matched = designsList.find(d => d.designName === card.designName);
      if (matched) setSelectedDesign(matched);
    }
  }, [card, designsList]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const clickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const handleDesignNameChange = (e) => {
    const { value } = e.target;
    setForm(f => ({ ...f, designName: value }));
    setShowSuggestions(true);
  };

  const selectDesign = (d) => {
    setSelectedDesign(d);

    // Auto-calculate standard values if pcs is already entered
    const pcsVal = parseFloat(form.pcs) || 0;
    const topVal = d.top100 ? (((d.top100 / 100) * pcsVal).toFixed(2)) : '';
    const sleeveVal = d.sleeve100 ? (((d.sleeve100 / 100) * pcsVal).toFixed(2)) : '';
    const bottomVal = d.bottom100 ? (((d.bottom100 / 100) * pcsVal).toFixed(2)) : '';
    const dupattaVal = d.dupatta100 ? (((d.dupatta100 / 100) * pcsVal).toFixed(2)) : '';
    const cutVal = d.cut100 ? d.cut100.toString() : ''; // Cut does not multiply by pcs
    const consumptionVal = d.totalMtr100 ? ((d.totalMtr100 / 100).toFixed(2)) : '';
    const totalMtrVal = d.totalMtr100 ? (((d.totalMtr100 / 100) * pcsVal).toFixed(2)) : '';
    const setCopyVal = d.setCopy100 ? (Math.round((d.setCopy100 / 100) * pcsVal)) : '';

    setForm(f => ({
      ...f,
      designName: d.designName,
      designer: d.designerName || f.designer,
      colourMatching: d.colourMatching || f.colourMatching,
      fabric: d.fabricName || f.fabric,
      category: d.category || f.category,
      temperature: d.fusingTemp || f.temperature,
      speed: d.speed || f.speed,
      colors: d.colors || f.colors,
      panna: d.panna || f.panna,
      pass: d.pass || f.pass,
      profile: (d.machineProfiles && form.machineName && d.machineProfiles[form.machineName]) || f.profile,
      paperType: d.paperType || f.paperType,
      imageUrl1: d.imageUrl || f.imageUrl1,
      imageUrl2: d.imageUrl2 || f.imageUrl2,
      designNo: d.designName,

      // Auto-calculated values based on pcs
      consumption: consumptionVal || f.consumption,
      top: topVal || f.top,
      sleeve: sleeveVal || f.sleeve,
      bottom: bottomVal || f.bottom,
      dupatta: dupattaVal || f.dupatta,
      cut: cutVal || f.cut,
      totalMtr: totalMtrVal || f.totalMtr,
      setCopy: setCopyVal || f.setCopy,
    }));
    setShowSuggestions(false);
  };

  const filteredDesigns = useMemo(() =>
    form.designName
      ? designsList.filter(d => d.designName.toLowerCase().includes(form.designName.toLowerCase()))
      : designsList,
    [form.designName, designsList]
  );

  // Auto-recalculate EXP.TIME whenever relevant fields change
  useEffect(() => {
    const et = calcExpTime(form.panna, form.pass, form.totalMtr, form.machineName);
    if (et !== form.expTime) setForm(f => ({ ...f, expTime: et }));
  }, [form.panna, form.pass, form.totalMtr, form.machineName]);

  // Auto-resolve profile when machine changes
  useEffect(() => {
    if (selectedDesign && selectedDesign.machineProfiles && form.machineName) {
      const p = selectedDesign.machineProfiles[form.machineName];
      if (p !== undefined) {
        setForm(f => ({ ...f, profile: p }));
      }
    }
  }, [form.machineName, selectedDesign]);

  const onChange = e => {
    const { name, value } = e.target;

    if (name === 'pcs' && selectedDesign) {
      const pcsVal = parseFloat(value) || 0;
      const d = selectedDesign;

      const topVal = d.top100 ? (((d.top100 / 100) * pcsVal).toFixed(2)) : '';
      const sleeveVal = d.sleeve100 ? (((d.sleeve100 / 100) * pcsVal).toFixed(2)) : '';
      const bottomVal = d.bottom100 ? (((d.bottom100 / 100) * pcsVal).toFixed(2)) : '';
      const dupattaVal = d.dupatta100 ? (((d.dupatta100 / 100) * pcsVal).toFixed(2)) : '';
      const cutVal = d.cut100 ? d.cut100.toString() : ''; // Cut does not multiply by pcs
      const consumptionVal = parseFloat(form.consumption) || (d.totalMtr100 ? d.totalMtr100 / 100 : 0);
      const totalMtrVal = (pcsVal * consumptionVal).toFixed(2);
      const setCopyVal = d.setCopy100 ? (Math.round((d.setCopy100 / 100) * pcsVal)) : '';

      setForm(f => ({
        ...f,
        pcs: value,
        top: topVal || f.top,
        sleeve: sleeveVal || f.sleeve,
        bottom: bottomVal || f.bottom,
        dupatta: dupattaVal || f.dupatta,
        cut: cutVal || f.cut,
        totalMtr: totalMtrVal || f.totalMtr,
        setCopy: setCopyVal || f.setCopy,
      }));
    } else if (name === 'consumption') {
      const pcsVal = parseFloat(form.pcs) || 0;
      const consVal = parseFloat(value) || 0;
      const totalMtrVal = (pcsVal * consVal).toFixed(2);
      setForm(f => ({
        ...f,
        consumption: value,
        totalMtr: totalMtrVal
      }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobNo.trim()) { setError('Job No. is required.'); return; }
    setSaving(true); setError('');
    try {
      if (card?._id) {
        await api.updateJobCard(card._id, form);
      } else {
        await api.createJobCard(form);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save job card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', paddingTop:'1rem' }}>
      <div style={{ background:'var(--bg-modal,#111827)', border:'1px solid var(--border-light)',
        borderRadius:'var(--radius-lg)', width:'100%', maxWidth:900,
        boxShadow:'var(--shadow-lg)', overflow:'hidden', maxHeight:'96vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border-light)',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:36, height:36, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
              background: form.machineName === 'GRANDO' ? '#0b5394' : form.machineName === 'PRINTDOT' ? '#ea4444' : 'var(--primary-glow)',
              transition:'background 0.3s ease' }}>
              <Cpu size={18} color="#fff"/>
            </div>
            <div>
              <h3 style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--text-primary)' }}>
                {card ? `Edit Job Card — ${card.jobNo}` : 'New Job Card'}
              </h3>
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:1 }}>Elite Digital Prints</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={16}/></button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} style={{ overflowY:'auto', padding:'1.25rem 1.5rem', flex:1 }}>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:'var(--radius-sm)', padding:'0.6rem 0.9rem', color:'#fca5a5',
            fontSize:'0.8rem', marginBottom:'1rem' }}>{error}</div>}

          {/* Machine selector — highlighted */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'0.4rem' }}>Machine Name *</div>
            <div style={{ display:'flex', gap:'0.6rem', flexWrap: 'wrap' }}>
              {(printConfig.machines || []).map(mObj => {
                const m = mObj.name;
                const isSelected = form.machineName === m;
                const primaryColor = m === 'GRANDO' ? '#3b82f6' : m === 'PRINTDOT' ? '#ef4444' : '#8b5cf6';
                const bgColor = m === 'GRANDO' ? 'rgba(59,130,246,0.15)' : m === 'PRINTDOT' ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.15)';
                return (
                  <button type="button" key={m} onClick={() => setForm(f=>({...f,machineName:m}))}
                    style={{ flex: '1 1 auto', minWidth: '100px', padding:'0.6rem', borderRadius:'var(--radius-sm)', fontWeight:700, fontSize:'0.9rem',
                      border:`2px solid ${isSelected ? primaryColor : 'var(--border-light)'}`,
                      background: isSelected ? bgColor : 'transparent',
                      color: isSelected ? primaryColor : 'var(--text-muted)',
                      cursor:'pointer', transition:'all 0.2s' }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Core IDs */}
          <div style={sectionLabel}>📋 Job Details</div>
          <div style={rowStyle}>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flex: '0 0 calc(50% - 0.4rem)', minWidth:120 }}>
              <Field label="Job No. *" name="jobNo" form={form} onChange={onChange} half={false} />
              {!card && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0 2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Auto +1 enabled</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const newStart = window.prompt("Set Starting Job Card Number:", printConfig.startingJobNo || 1);
                      if (newStart !== null) {
                        const digits = newStart.match(/\d+/);
                        const num = digits ? parseInt(digits[0], 10) : NaN;
                        if (isNaN(num) || num < 1) {
                          alert("Please enter a valid positive number.");
                          return;
                        }
                        try {
                          await api.updatePrintConfig({ action: 'set', field: 'startingJobNo', value: num });
                          const res = await api.getNextJobCardNo();
                          if (res && res.nextJobNo) {
                            setForm(f => ({ ...f, jobNo: String(res.nextJobNo) }));
                          }
                          setPrintConfig(prev => ({ ...prev, startingJobNo: num }));
                        } catch (err) {
                          console.error("Failed to update starting Job number:", err);
                        }
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.72rem' }}
                  >
                    Set Starting No
                  </button>
                </div>
              )}
            </div>
            <div ref={suggestionsRef} style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flex: '0 0 calc(50% - 0.4rem)', minWidth:120, position:'relative' }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                Design Name (ED1, ED2...)
              </label>
              <input
                type="text"
                name="designName"
                value={form.designName}
                onChange={handleDesignNameChange}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type ED1, ED2 or select..."
                style={{
                  padding:'0.5rem 0.7rem',
                  fontSize:'0.85rem',
                  borderColor: 'var(--primary)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--primary)',
                  fontWeight: 700
                }}
              />
              {showSuggestions && filteredDesigns.length > 0 && (
                <div style={{
                  position:'absolute',
                  top:'100%',
                  left:0,
                  right:0,
                  background:'var(--bg-modal, #161b26)',
                  border:'1px solid var(--border-light)',
                  borderRadius:'var(--radius-sm)',
                  boxShadow:'var(--shadow-lg)',
                  maxHeight:'160px',
                  overflowY:'auto',
                  zIndex:999,
                  marginTop:'4px'
                }}>
                  {filteredDesigns.map(d => (
                    <div
                      key={d._id}
                      onClick={() => selectDesign(d)}
                      style={{
                        padding:'0.5rem 0.75rem',
                        fontSize:'0.8rem',
                        cursor:'pointer',
                        borderBottom:'1px solid var(--border-light)',
                        color:'var(--text-primary)',
                        display:'flex',
                        justifyContent:'space-between',
                        alignItems:'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight:700, color:'var(--primary)' }}>{d.designName}</span>
                      <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                        {d.fabricName ? `${d.fabricName} ` : ''}({d.designerName || 'No Designer'})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field label="Date" name="date" type="date" form={form} onChange={onChange} half/>
            <Field label="Status" name="status" form={form} onChange={onChange}
              options={['Pending','In Progress','Done']} half/>
          </div>

          {/* Section: Party Details */}
          <div style={sectionLabel}>🏢 Party Details</div>
          <div style={rowStyle}>
            <Field label="Party Name" name="party" form={form} onChange={onChange} options={['', ...(printConfig.parties || [])]} half/>
            <Field label="Bill To" name="billTo" form={form} onChange={onChange} options={['', ...(printConfig.billToOptions || [])]} half/>
            <Field label="Ship To" name="shipTo" form={form} onChange={onChange} options={['', ...(printConfig.shipToOptions || [])]} half/>
          </div>

          {/* Section: Fabric & Garment */}
          <div style={sectionLabel}>👗 Garment Details</div>
          <div style={rowStyle}>
            <Field label="Category" name="category" form={form} onChange={onChange} options={['', ...printConfig.categories]} half/>
            <Field label="Fabric" name="fabric" form={form} onChange={onChange} options={['', ...(printConfig.fabrics || [])]} half/>
            <Field label="PCS" name="pcs" form={form} onChange={onChange} half/>
            <Field label="Top" name="top" form={form} onChange={onChange} half/>
            <Field label="Sleeve" name="sleeve" form={form} onChange={onChange} half/>
            <Field label="Bottom" name="bottom" form={form} onChange={onChange} half/>
            <Field label="Dupatta" name="dupatta" form={form} onChange={onChange} half/>
            <Field label="Cut" name="cut" form={form} onChange={onChange} half/>
            <Field label="Colors" name="colors" form={form} onChange={onChange} options={COLOR_NAMES} half/>
          </div>

          {/* Section: Print Config */}
          <div style={sectionLabel}>🖨 Print Configuration</div>
          <div style={rowStyle}>
            <Field label="Panna (Width)" name="panna" form={form} onChange={onChange} options={['', ...(printConfig.widths || [])]} half/>
            <Field label="Profile" name="profile" form={form} onChange={onChange} options={['', ...((printConfig.machines?.find(m => m.name === form.machineName)?.profiles) || [])]} half/>
            <Field label="Pass" name="pass" form={form} onChange={onChange} half
              options={['', ...printConfig.passes]}/>
            <Field label="Total Mtr" name="totalMtr" type="number" form={form} onChange={onChange} half/>
            <Field label="EXP. Time (Auto)" name="expTime" form={form} onChange={onChange} half readOnly highlight/>
            <Field label="Consumption" name="consumption" form={form} onChange={onChange} half/>
            <Field label="All Over" name="allover" form={form} onChange={onChange} half/>
            <Field label="PN/KM" name="pnKm" form={form} onChange={onChange} type="select" options={['PN', 'KM']} half/>
            <Field label="Set Copy" name="setCopy" form={form} onChange={onChange} half/>
            <Field label="Paper Type" name="paperType" form={form} onChange={onChange} options={['', ...(printConfig.paperTypes || [])]} half/>
            
            {/* Smart consumption preview box */}
            {(() => {
              const estimatedFabric = parseFloat(form.totalMtr) || 0;
              const estimatedPaper = (estimatedFabric * 1.02).toFixed(1);
              const estimatedPaperRolls = (estimatedFabric / 100).toFixed(2);
              const estimatedInk = (estimatedFabric * 0.015).toFixed(2);
              return (
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px dashed rgba(56, 189, 248, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 1rem',
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <Cpu size={14} /> 🧮 Smart Material Consumption Estimate
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fabric Needed:</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{estimatedFabric} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>meters</span></div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paper rolls (Est):</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{estimatedPaper} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>meters</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({estimatedPaperRolls} rolls)</span></div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ink consumed (Est):</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{estimatedInk} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>liters</span></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Section: Fusing Config */}
          <div style={sectionLabel}>🔥 Fusing Configuration</div>
          <div style={rowStyle}>
            <Field label="Temperature" name="temperature" type="select" form={form} onChange={onChange} options={['', ...(printConfig.temperatures || [])]} half/>
            <Field label="Speed" name="speed" type="select" form={form} onChange={onChange} options={['', ...(printConfig.speeds || [])]} half/>
          </div>

          {/* Section: Persons */}
          <div style={sectionLabel}>👤 Personnel</div>
          <div style={rowStyle}>
            <Field label="Designer" name="designer" form={form} onChange={onChange} options={printConfig.designers || []} half/>
            <Field label="Colour Matching" name="colourMatching" form={form} onChange={onChange} options={printConfig.designers || []} half/>
          </div>

          {/* Section: Notes */}
          <div style={sectionLabel}>📝 Notes</div>
          <div style={rowStyle}>
            <Field label="Note 1" name="note1" form={form} onChange={onChange}/>
            <Field label="Emergency Notes" name="emergencyNotes" form={form} onChange={onChange}/>
            <Field label="Note 2" name="note2" form={form} onChange={onChange}/>
          </div>

          {/* Section: Images */}
          <div style={sectionLabel}>🖼 Design Images</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.6rem', lineHeight:1.5 }}>
            📂 From your Drive folder — open it, right-click any image → <strong>Share</strong> → <strong>Copy link</strong> → paste below.
          </div>
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
            <ImageField label="Image 1 — Design / Pattern" name="imageUrl1" form={form} onChange={onChange} index={1}/>
            <ImageField label="Image 2 — Fabric / Full View" name="imageUrl2" form={form} onChange={onChange} index={2}/>
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-light)',
          display:'flex', gap:'0.75rem', justifyContent:'flex-end', flexShrink:0 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding:'0.55rem 1.2rem' }}>Cancel</button>
          <button type="submit" form="jcForm" className="btn-primary" style={{ padding:'0.55rem 1.4rem' }}
            onClick={handleSubmit} disabled={saving}>
            <Save size={14}/>
            {saving ? 'Saving...' : card ? 'Update Job Card' : 'Create Job Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabel = {
  fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em',
  color:'var(--primary)', marginBottom:'0.6rem', marginTop:'1rem',
  borderBottom:'1px solid var(--border-light)', paddingBottom:'0.3rem',
};
const rowStyle = {
  display:'flex', flexWrap:'wrap', gap:'0.8rem', marginBottom:'0.5rem',
};

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────
export default function JobCardPanel({ activeSubTab = 'jobcards' }) {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('jobNo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [formCard, setFormCard] = useState(null);   // null=closed, {}=new, {...}=edit
  const [showForm, setShowForm] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Sharing to Chat states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [shareSearch, setShareSearch] = useState('');
  const [sharingJobCard, setSharingJobCard] = useState(false);

  // ── Debounced search: fires API only after user stops typing for 400ms ──────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (showShareModal) {
      const loadRooms = async () => {
        try {
          const currentUser = api.getCurrentUser();
          const userId = currentUser ? (currentUser._id || currentUser.id) : '';
          const res = await api.getRooms(userId);
          if (res.data) setChatRooms(res.data);
        } catch (err) {
          console.error('Failed to load chat rooms for sharing', err);
        }
      };
      loadRooms();
    }
  }, [showShareModal]);

  const handleOpenShareModal = (card) => {
    setShareCard(card);
    setShowShareModal(true);
  };

  const handleShareJobCard = async (e) => {
    e.preventDefault();
    if (!selectedRoomId || !shareCard) return;

    setSharingJobCard(true);
    try {
      const currentUser = api.getCurrentUser();
      const senderId = currentUser ? (currentUser._id || currentUser.id) : '';
      if (!senderId) {
        alert('You must be signed in to share job cards.');
        return;
      }

      const apiBase = getBaseUrl();
      const fullBase = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
      const downloadLink = `${fullBase}/jobCards/pdf/${shareCard._id}`;

      let content = `📋 *SHARED JOB CARD: ${shareCard.jobNo}*\n`;
      content += `🏢 *Party:* ${shareCard.party || '—'}\n`;
      content += `🎨 *Design:* ${shareCard.designName || shareCard.designNo || '—'}\n`;
      content += `👕 *Fabric:* ${shareCard.fabric || '—'} · *Colors:* ${shareCard.colors || '—'}\n`;
      content += `📏 *Panna:* ${shareCard.panna || '—'} · *Total Mtr:* ${shareCard.totalMtr || '—'}\n`;
      content += `⚡ *EXP. Time:* ${shareCard.expTime || '—'} · *Urgency:* ${shareCard.urgency || 'Normal'}\n`;
      content += `🔄 *Status:* ${shareCard.status || 'To Do'}\n\n`;
      content += `🔗 *Download PDF:* ${downloadLink}`;

      await api.sendRoomMessage(selectedRoomId, { senderId, content });
      alert('Job Card shared successfully to the chat room!');
      setShowShareModal(false);
      setShareCard(null);
      setSelectedRoomId('');
      setShareSearch('');
    } catch (err) {
      console.error('Failed to share job card', err);
      alert('Failed to share job card.');
    } finally {
      setSharingJobCard(false);
    }
  };

  const fetchCards = useCallback(async () => {
    if (activeSubTab !== 'list') return;
    // Cancel any in-flight request to prevent race conditions
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true); setError('');
    try {
      const res = await api.getJobCards({
        search: debouncedSearch,
        status: statusFilter === 'All' ? '' : statusFilter,
        page,
        limit: 25,
        sortBy,
        sortOrder,
        dateStart,
        dateEnd
      });
      if (!controller.signal.aborted) {
        setCards(res.data || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to load job cards.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, activeSubTab, sortBy, sortOrder, dateStart, dateEnd]);

  useEffect(() => {
    fetchCards();
    const interval = setInterval(fetchCards, 30000);
    return () => clearInterval(interval);
  }, [fetchCards, activeSubTab]);

  const handleDelete = async (id, jobNo) => {
    if (!window.confirm(`Delete Job Card "${jobNo}"?`)) return;
    try {
      await api.deleteJobCard(id);
      fetchCards();
    } catch (err) {
      alert(err.message || 'Failed to delete.');
    }
  };

  const openNew  = () => { setFormCard(null); setShowForm(true); };
  const openEdit = (c) => { setFormCard(c); setShowForm(true); };
  const onSaved  = () => { setShowForm(false); fetchCards(); };

  const MACHINE_COLOR = { GRANDO:'#3b82f6', PRINTDOT:'#ef4444' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
      {activeSubTab === 'catalogue' ? (
        <DesignCatalogue />
      ) : activeSubTab === 'master' ? (
        <DesignMaster />
      ) : activeSubTab === 'fabric' ? (
        <FabricInventoryPanel />
      ) : activeSubTab === 'raw_materials' ? (
        <RawMaterialsPanel />
      ) : activeSubTab === 'tracking' ? (
        <JobCardTracking onPreview={setPreviewCard} />
      ) : activeSubTab === 'settings' ? (
        <PrintSettings />
      ) : activeSubTab === 'jobcards' ? (
        <ReportsCenter department="elite-print" />
      ) : (
        <>
          {/* Header banner */}
          <div className="glass-panel" style={{ padding:'1.25rem 1.5rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#38bdf8,#8b5cf6)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FileText size={22} color="#fff"/>
                </div>
                <div>
                  <h2 style={{ fontSize:'1.2rem', fontWeight:800, color:'var(--text-primary)' }}>Elite Digital Prints</h2>
                  <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:1 }}>
                    Job Card Management — {total} total cards
                  </p>
                </div>
              </div>
              <button className="btn-primary" onClick={openNew} style={{ padding:'0.55rem 1.25rem' }}>
                <PlusCircle size={15}/> New Job Card
              </button>
            </div>
          </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding:'1rem 1.25rem' }}>
        <div style={{ display:'flex', gap:'0.8rem', alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:'1 1 220px' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input type="text" value={search} onChange={e=>{ setSearch(e.target.value); }}
              placeholder="Search Job No., Party, Design…"
              style={{ paddingLeft:32, width:'100%', fontSize:'0.85rem' }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              value={dateStart}
              onChange={e => { setDateStart(e.target.value); setPage(1); }}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', width: '135px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--nav-bg)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', width: '135px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'var(--nav-bg)', color: 'var(--text-primary)' }}
            />
          </div>
          {['All','Pending','In Progress','Done'].map(s=>(
            <button key={s} onClick={()=>{ setStatusFilter(s); setPage(1); }}
              style={{ padding:'0.45rem 0.9rem', fontSize:'0.8rem', borderRadius:'var(--radius-sm)',
                fontFamily:'var(--font-sans)', fontWeight:600, cursor:'pointer', border:'1px solid',
                borderColor: statusFilter===s ? 'var(--primary)' : 'var(--border-light)',
                background: statusFilter===s ? 'var(--nav-active-bg)' : 'transparent',
                color: statusFilter===s ? 'var(--primary)' : 'var(--text-muted)',
                transition:'all 0.15s' }}>
              {s}
            </button>
          ))}
          <button onClick={() => { setSortBy(prev => prev === 'urgency' ? '' : 'urgency'); setPage(1); }}
            style={{ padding:'0.45rem 0.9rem', fontSize:'0.8rem', borderRadius:'var(--radius-sm)',
              fontFamily:'var(--font-sans)', fontWeight:600, cursor:'pointer', border:'1px solid',
              borderColor: sortBy==='urgency' ? '#fbbf24' : 'var(--border-light)',
              background: sortBy==='urgency' ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: sortBy==='urgency' ? '#fbbf24' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              transition:'all 0.15s' }}>
            🔥 Urgency Priority
          </button>
          <button onClick={fetchCards} className="btn-icon" title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''}/>
          </button>
          
          <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
            <button 
              type="button" 
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.35rem 0.6rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--nav-active-bg)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.35rem 0.6rem',
                border: 'none',
                background: viewMode === 'list' ? 'var(--nav-active-bg)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <List size={14} /> List
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
        borderRadius:'var(--radius-sm)', padding:'0.75rem 1rem', color:'#fca5a5', fontSize:'0.85rem' }}>{error}</div>}

      {/* Cards Grid */}
      {loading && cards.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'3rem', color:'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin-loader" color="var(--primary)"/>
          <p style={{ marginTop:'1rem' }}>Loading job cards…</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="glass-panel" style={{ padding:'3rem', textAlign:'center' }}>
          <FileText size={48} color="var(--text-muted)" style={{ opacity:0.4 }}/>
          <h4 style={{ marginTop:'1rem', color:'var(--text-primary)' }}>No Job Cards Found</h4>
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginTop:4 }}>Click "New Job Card" to create your first one.</p>
          <button className="btn-primary" onClick={openNew} style={{ marginTop:'1.25rem', padding:'0.55rem 1.3rem' }}>
            <PlusCircle size={14}/> Create Job Card
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                    <th 
                      onClick={() => {
                        if (sortBy === 'jobNo') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('jobNo');
                          setSortOrder('desc');
                        }
                        setPage(1);
                      }}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                    >
                      Job No {sortBy === 'jobNo' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Design</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fabric</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colors</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Panna</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Mtr</th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'date') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('date');
                          setSortOrder('desc');
                        }
                        setPage(1);
                      }}
                      style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                    >
                      Date {sortBy === 'date' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(c => (
                    <tr 
                      key={c._id} 
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{c.jobNo}</span>
                          {c.emergencyNotes && c.emergencyNotes.trim() && (
                            <span title="Urgent" style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.6rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>URGENT</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.party || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>{c.designName || c.designNo || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.fabric || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.colors || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.panna || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{c.totalMtr || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.date || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => setPreviewCard(c)} className="btn-icon" title="Preview" style={{ padding: '0.3rem' }}><Eye size={13} /></button>
                          <button onClick={() => openEdit(c)} className="btn-icon" title="Edit" style={{ padding: '0.3rem' }}><Edit2 size={13} /></button>
                          <button 
                            onClick={() => handleOpenShareModal(c)} 
                            title="Share to Chat" 
                            style={{
                              padding: '0.3rem',
                              border: 'none',
                              background: 'transparent',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--radius-xs)',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Send size={13} />
                          </button>
                          <button 
                            onClick={() => handleDelete(c._id, c.jobNo)} 
                            title="Delete" 
                            style={{
                              padding: '0.3rem',
                              border: 'none',
                              background: 'transparent',
                              color: '#f87171',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--radius-xs)',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'1rem' }}>
              {cards.map(c => (
                <div key={c._id} className="glass-panel" style={{ padding:'1.1rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.7rem',
                  transition:'transform 0.15s ease, box-shadow 0.15s ease' }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>

                  {/* Card header */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, fontSize:'0.95rem', color:'var(--text-primary)' }}>{c.jobNo}</span>
                      {c.machineName && (
                        <span style={{ padding:'0.15rem 0.55rem', borderRadius:6, fontSize:'0.65rem', fontWeight:800,
                          background: c.machineName==='GRANDO' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                          color: MACHINE_COLOR[c.machineName] || '#fff', border:`1px solid ${MACHINE_COLOR[c.machineName] || 'transparent'}` }}>
                          {c.machineName}
                        </span>
                      )}
                      {c.emergencyNotes && c.emergencyNotes.trim() && (
                        <span style={{ padding:'0.15rem 0.55rem', borderRadius:6, fontSize:'0.65rem', fontWeight:800,
                          background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                          🔥 URGENT
                        </span>
                      )}
                    </div>
                    <StatusBadge status={c.status}/>
                  </div>

                  {/* Info grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.35rem 0.6rem', fontSize:'0.8rem' }}>
                    {[
                      ['Party', c.party], ['Design', c.designName || c.designNo],
                      ['Fabric', c.fabric], ['Date', c.date],
                      ['Designer', c.designer], ['C.Match', c.colourMatching],
                      ['Total Mtr', c.totalMtr], ['EXP.TIME', c.expTime],
                    ].map(([k,v])=>(
                      <div key={k} style={{ display:'flex', gap:'0.3rem' }}>
                        <span style={{ color:'var(--text-muted)', fontWeight:600, flexShrink:0 }}>{k}:</span>
                        <span style={{ color: k==='EXP.TIME'||k==='Design' ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: k==='EXP.TIME'||k==='Design' ? 700 : 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {v || '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:'0.5rem', borderTop:'1px solid var(--border-light)', paddingTop:'0.7rem' }}>
                    <button onClick={()=>setPreviewCard(c)} className="btn-secondary"
                      style={{ flex:1, padding:'0.4rem', fontSize:'0.78rem', justifyContent:'center' }}>
                      <Eye size={13}/> Preview
                    </button>
                    <button onClick={()=>openEdit(c)} className="btn-secondary"
                      style={{ flex:1, padding:'0.4rem', fontSize:'0.78rem', justifyContent:'center' }}>
                      <Edit2 size={13}/> Edit
                    </button>
                    <button onClick={()=>handleOpenShareModal(c)} className="btn-secondary"
                      style={{ padding:'0.4rem 0.7rem', fontSize:'0.78rem', borderRadius:'var(--radius-sm)',
                        background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)',
                        color:'#60a5fa', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem',
                        fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                      <Send size={13}/>
                    </button>
                    <button onClick={()=>handleDelete(c._id, c.jobNo)}
                      style={{ padding:'0.4rem 0.7rem', fontSize:'0.78rem', borderRadius:'var(--radius-sm)',
                        background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                        color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem',
                        fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginTop:'0.5rem' }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-icon">
                <ChevronLeft size={14}/>
              </button>
              <span style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>Page {page} of {pages}</span>
              <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages} className="btn-icon">
                <ChevronRight size={14}/>
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && (
        <JobCardForm card={formCard} onSave={onSaved} onClose={()=>setShowForm(false)}/>
      )}
      {previewCard && (
        <JobCardPrintView 
          card={previewCard} 
          onClose={()=>setPreviewCard(null)}
          onShare={(c) => {
            setPreviewCard(null);
            handleOpenShareModal(c);
          }}
        />
      )}

      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: '#161b26',
            border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Share Job Card to Chat</h3>
              <button 
                onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleShareJobCard}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Search Channel or Member</label>
                <input 
                  type="text" 
                  value={shareSearch} 
                  onChange={e => setShareSearch(e.target.value)} 
                  placeholder="Type name to search..." 
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Chat Destination</label>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'rgba(255,255,255,0.01)'
                }}>
                  {chatRooms
                    .filter(r => {
                      if (!shareSearch) return true;
                      const roomName = r.type === 'direct' 
                        ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || '')
                        : (r.name || '');
                      return roomName.toLowerCase().includes(shareSearch.toLowerCase());
                    })
                    .map(r => {
                      const isDirect = r.type === 'direct';
                      const displayName = isDirect 
                        ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || 'Direct Message')
                        : `# ${r.name}`;
                      const isSelected = selectedRoomId === r._id;
                      
                      return (
                        <div 
                          key={r._id} 
                          onClick={() => setSelectedRoomId(r._id)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isDirect ? 'var(--success)' : 'var(--primary)'
                          }} />
                          <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '600' : 'normal', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{displayName}</span>
                        </div>
                      );
                    })}
                  {chatRooms.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No active channels or messages found.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); }} 
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={sharingJobCard || !selectedRoomId}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: selectedRoomId ? 'var(--primary)' : 'var(--border-light)',
                    color: '#0b0f19',
                    cursor: selectedRoomId ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {sharingJobCard ? 'Sharing...' : 'Confirm Share'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
