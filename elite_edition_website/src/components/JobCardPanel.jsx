import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  PlusCircle, Search, RefreshCw, Edit2, Trash2, FileText,
  Printer, ChevronLeft, ChevronRight, Clock, CheckCircle,
  AlertCircle, Cpu, X, Save, Eye, Image, Image as ImageIcon, LayoutGrid, List, Send, Download, Receipt, Loader, User,
  Building2, Scissors, SlidersHorizontal, ZoomIn, Layers, ShieldCheck, Truck, Flame, Sparkles, ExternalLink, Activity
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import ErrorBoundary from './common/ErrorBoundary';
import UnifiedFilterPopover from './common/UnifiedFilterPopover';
import DesignCatalogue from './DesignCatalogue';
import DesignMaster from './DesignMaster';
import JobCardTracking from './JobCardTracking';
import PrintSettings from './PrintSettings';
import ReportsCenter from './ReportsCenter';
import FabricInventoryPanel from './FabricInventoryPanel';
import RawMaterialsPanel from './RawMaterialsPanel';
import EliteBillingDepartment from './EliteBillingDepartment';
import DigitalPrintCostingScreen from './DigitalPrintCostingScreen';
import EliteDigitalPrintsSplitView from './EliteDigitalPrintsSplitView';
import JobPrintingLog from './JobPrintingLog';
import FusingDepartment from './FusingDepartment';
import GarmentJobCardDashboard from './GarmentJobCardDashboard';
import StitchingChallanPanel from './StitchingChallanPanel';
import StitchingSettings from './StitchingSettings';
import QADepartment from './QADepartment';
import JobCardStatusDashboard from './JobCardStatusDashboard';
import DigitalPrintOperationsDashboard from './DigitalPrintOperationsDashboard';
import StatusPill from './common/StatusPill';
import JobStageProgressBar from './common/JobStageProgressBar';
import { SmartActionGroup, SmartIconButton } from './common/SmartActionGroup';
import { areDesignsEquivalent, cleanDesignNameString, extractDesignNames } from '../utils/designUtils';
import { R2_PUBLIC_BASE, convertDriveUrl, getImageCandidates } from '../utils/imageUrlHelper';
import InfiniteScrollPagination from './InfiniteScrollPagination';
import QRCode from 'qrcode';
import { buildTpAndWasteGrid } from '../utils/jobCardTpHelper';

export function JobCardQrBadge({ card, size = 32 }) {
  const [qrUrl, setQrUrl] = useState('');
  useEffect(() => {
    let active = true;
    const cleanJobNo = String(card?.jobNo || '').replace(/^JC-/i, '').replace(/^JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
    const id = cleanJobNo || card?._id || card?.id;
    if (!id) return;
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://erp.eliteedition.in';
    const baseUrl = origin.includes('localhost') ? 'https://erp.eliteedition.in' : origin;
    const targetUrl = `${baseUrl}/verify/jobcard/${encodeURIComponent(id)}`;
    QRCode.toDataURL(targetUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' }).then(url => {
      if (active) setQrUrl(url);
    }).catch(() => {});
    return () => { active = false; };
  }, [card?.jobNo, card?._id, card?.id]);

  if (!qrUrl) return <div style={{ width: size, height: size }} />;
  return (
    <img
      src={qrUrl}
      alt="Job Card QR"
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
      title="Scan to view full Job Card"
    />
  );
}

const normalizeFabricName = (val, pannaVal = '') => {
  if (!val) return '';
  let str = String(val).trim().toUpperCase();

  let extractedPanna = '';
  const pannaMatches = str.match(/(?:\s+(\d+))+\s*$/);
  if (pannaMatches) {
    const digits = pannaMatches[0].trim().split(/\s+/);
    extractedPanna = digits[digits.length - 1];
    str = str.replace(/(?:\s+(\d+))+\s*$/, '').trim();
  }

  let base = str;
  if (base === 'LINEN' || base === 'KOINUR LINEN' || base === 'KOHINUR LINEN' || base === 'KOHINOOR LINEN' || base.includes('KOINUR') || base.includes('KOHINOOR') || base.includes('KOHINUR')) {
    base = 'KOHINOOR LINEN';
  } else if (base === 'REYON' || base === 'RAYON' || base === 'POLY REYON' || base === 'POLY RAYON' || base.includes('REYON') || base.includes('RAYON')) {
    if (base.includes('30 SPN')) {
      base = 'POLY REYON 30 SPN';
    } else {
      base = 'POLY REYON';
    }
  } else if (base === 'CREPE' || base === 'CRAPE' || base === 'FRANCH CREPE' || base === 'FRENCH CREP' || base.includes('CREPE') || base.includes('CRAPE') || base.includes('CREP')) {
    base = 'FRENCH CREPE';
  } else if (base === 'CAMRIK' || base === 'CEMBRIC' || base === 'CEMBRIK' || base === 'CAMBRIK' || base.includes('CAMRIK') || base.includes('CEMBRIK')) {
    base = 'CAMBRIC';
  } else if (base === 'MAL' || base === 'POLY MAL' || base === 'POLYMALL' || base === 'POLY MLL' || base === 'POLLY MAL') {
    base = 'POLLY MAL';
  }

  let finalPanna = extractedPanna || (pannaVal ? String(pannaVal).trim().replace(/['"]/g, '') : '');
  if (finalPanna === '38' || finalPanna === '46' || finalPanna === '56') finalPanna = '58';
  if (!finalPanna || finalPanna.toUpperCase() === 'UNKNOWN' || isNaN(parseInt(finalPanna, 10))) {
    if (base.includes('ARMANI')) finalPanna = '44';
    else finalPanna = '58';
  }

  return `${base} ${finalPanna}`;
};
import DigitalPrintComplainModule from './DigitalPrintComplainModule';
import DigitalPrintExpenseModule from './DigitalPrintExpenseModule';
import DateRangePicker from './DateRangePicker';
import ScreenGroupRoster from './ScreenGroupRoster';
import { dispatchScreenGroupEvent } from '../services/screenGroupService';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import { COLOR_NAMES, getColorHex } from '../utils/colors';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import JobCardTooltip from './JobCardTooltip';

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
  let pannaNum = pannaMatch ? Number(pannaMatch[0]) : null;
  const passMatch = String(passText || '').match(/\d+/);
  let pass = passMatch ? Number(passMatch[0]) : null;
  if (!totalMtr || Number(totalMtr) <= 0) return '';

  const mName = String(machineName || '').trim().toUpperCase();
  const table = mName === 'GRANDO' ? SPEED_GRANDO : SPEED_PRINTDOT;

  if (!pannaNum) pannaNum = 58;
  const availablePannas = [36, 38, 42, 44, 46, 58];
  let targetPanna = availablePannas.reduce((prev, curr) => 
    Math.abs(curr - pannaNum) < Math.abs(prev - pannaNum) ? curr : prev
  );

  if (!pass) pass = 4;
  const availablePasses = [1, 2, 4, 6, 8];
  let targetPass = availablePasses.reduce((prev, curr) => 
    Math.abs(curr - pass) < Math.abs(prev - pass) ? curr : prev
  );

  const speed = (table[targetPanna] && table[targetPanna][targetPass]) || 186;
  const time = Number(totalMtr) / speed;
  let hours = Math.floor(time);
  let minutes = Math.round((time - hours) * 60);
  if (minutes === 60) { hours += 1; minutes = 0; }
  return `${hours}H & ${minutes}M`;
}


// ─── Extract multiple design names helper ────────────────────────────────────
// ─── Blank form ──────────────────────────────────────────────────────────────
const BLANK = {
  jobNo:'', designNo:'', designName:'', category:'', fabric:'', pcs:'', top:'', sleeve:'',
  colors:'', panna:'', consumption:'', bottom:'', dupatta:'', cut:'',
  date: new Date().toISOString().split('T')[0],
  pass:'', allover:'', pnKm:'PN', setCopy:'', totalMtr:'', party:'',
  billTo:'', shipTo:'',
  clientPoNo:'', poNo:'', lotNo:'', targetDeliveryDate:'',
  rawPanna:'', fabricSource:'', shrinkagePct:'', freshYieldPct:'',
  expTime:'', designer:'', colourMatching:'', paperType:'',
  temperature:'', speed:'', profile:'', machineName:'',
  note1:'', note2:'', emergencyNotes:'', imageUrl1:'', imageUrl2:'',
  status:'Pending',
};

// ─── WORKFLOW PIPELINE STAGE BADGE (Minimal Text-Only) ──────────────────────
function WorkflowStageBadge({ card }) {
  if (!card) return null;
  const pStatus = (card.printStatus || '').toLowerCase();
  const isPrintDone = pStatus.includes('done') || parseFloat(card.printMtr || 0) > 0;
  
  const fStatus = (card.fusingStatus || '').toLowerCase();
  const fusedMtr = parseFloat(card.fusingMtr || card.freshMtr || 0);
  const isFusingDone = fStatus.includes('done');
  
  const deliveredMtr = parseFloat(card.deliveredMtr || 0);
  const totalMtr = parseFloat(card.totalMtr || card.totalQty || 0);
  const isDispatched = (card.deliveryStatus || '').toLowerCase().includes('done') || (totalMtr > 0 && deliveredMtr >= totalMtr);
  const isPartiallyDispatched = deliveredMtr > 0 && !isDispatched;

  if (isDispatched) {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'#ecfdf5', color:'#065f46', border:'1px solid #a7f3d0', fontSize:'11.5px', fontWeight:700, whiteSpace:'nowrap' }} title={`Dispatched: ${deliveredMtr}m`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
        4. Dispatched
      </span>
    );
  }

  if (isFusingDone || fusedMtr > 0) {
    const avail = Math.max(0, fusedMtr - deliveredMtr);
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe', fontSize:'11.5px', fontWeight:700, whiteSpace:'nowrap' }} title={`${fusedMtr}m fused (${avail}m ready for Challan)`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
        {isPartiallyDispatched ? `Partially Dispatched (${deliveredMtr}m)` : `3. Ready for Challan (${avail}m)`}
      </span>
    );
  }

  if (isPrintDone) {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', fontSize:'11.5px', fontWeight:700, whiteSpace:'nowrap' }} title="Printing is done. Next stage: Fusing Department">
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
        2. Fusing Pending
      </span>
    );
  }

  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0', fontSize:'11.5px', fontWeight:700, whiteSpace:'nowrap' }} title="Job Card created. Next stage: Printing Log">
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />
      1. Printing Pending
    </span>
  );
}

// ─── STATUS badge (Standardized Text-Only StatusPill) ───────────────────────
function StatusBadge({ status }) {
  return <StatusPill status={status} />;
}

async function resolveImageToDataUrl(candidates) {
  if (!candidates || candidates.length === 0) return '';
  for (const url of candidates) {
    if (!url) continue;
    if (url.startsWith('data:')) return url;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 100) {
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (e) {}
  }
  return '';
}

// ─── Print / PDF template (matches the physical job card layout) ─────────────
export async function triggerJobCardPrint(cardOrCards) {
  if (!cardOrCards) return;
  const cards = Array.isArray(cardOrCards) ? cardOrCards : [cardOrCards];
  if (cards.length === 0) return;

  // Open window synchronously on user click to prevent popup blockers
  const win = window.open('', '_blank', 'width=650,height=850');
  if (win) {
    try {
      win.document.write(`<!DOCTYPE html><html><head><title>Preparing Job Card Print...</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;height:80vh;color:#334155;background:#fff;} .loader{text-align:center;}</style></head><body><div class="loader"><div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">Preparing Job Card Print...</div><div style="font-size:0.85rem;color:#64748b;">Loading high-resolution design image...</div></div></body></html>`);
      win.document.close();
    } catch (e) {}
  }

  // Preload / resolve images to Data URLs in parallel
  const preparedCards = await Promise.all(cards.map(async (card) => {
    let imageUrl1 = card.imageUrl1 || card.imageUrl || card.proofing?.artworkUrl || '';
    let imageUrl2 = card.imageUrl2 || '';

    const keyStr = card.designName || card.designNo || '';
    const names = extractDesignNames(keyStr);
    const showTwoImages = names.length >= 2;

    const design1 = names[0] || card.designName || card.designNo || '';
    const design2 = names[1] || (card.designName ? `${card.designName}-2` : '');

    if (!imageUrl1 && design1) {
      imageUrl1 = `/v1/designs/${encodeURIComponent(design1)}.jpg`;
    }

    const candidates1 = getImageCandidates(imageUrl1, design1);
    const candidates2 = showTwoImages ? getImageCandidates(imageUrl2, design2) : [];

    const [dataUrl1, dataUrl2] = await Promise.all([
      resolveImageToDataUrl(candidates1),
      showTwoImages ? resolveImageToDataUrl(candidates2) : Promise.resolve('')
    ]);

    const finalImg1 = dataUrl1 || candidates1[0] || convertDriveUrl(imageUrl1, design1) || '';
    const finalImg2 = showTwoImages ? (dataUrl2 || candidates2[0] || convertDriveUrl(imageUrl2, design2) || '') : '';

    const cleanJobNo = String(card.jobNo || '').replace(/^JC-/i, '').replace(/^JOB\s*NO\.?\s*[-:]?\s*/i, '').trim();
    const qrIdentifier = cleanJobNo || card._id || card.id || '';
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://erp.eliteedition.in';
    const baseUrl = origin.includes('localhost') ? 'https://erp.eliteedition.in' : origin;
    const qrTargetUrl = `${baseUrl}/verify/jobcard/${encodeURIComponent(qrIdentifier)}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      });
    } catch (e) {
      console.warn('QR generation error:', e);
    }

    let challans = Array.isArray(card.challans) ? card.challans : [];
    if (!challans.length && card.jobNo) {
      try {
        const digits = cleanJobNo.match(/\d+/)?.[0];
        const cRes = await api.getFabricChallans({ search: digits || cleanJobNo || card.jobNo, limit: 10 });
        challans = Array.isArray(cRes) ? cRes : (cRes?.data || []);
      } catch (e) {
        console.warn('Could not fetch challans for job card print:', e);
      }
    }

    return {
      card,
      design1,
      design2,
      showTwoImages,
      img1: finalImg1,
      img2: finalImg2,
      candidates1,
      candidates2,
      qrDataUrl,
      challans
    };
  }));

  if (!win || win.closed) return;

  const titleText = cards.length === 1 ? `Job Card ${cards[0].jobNo || ''}` : `${cards.length} Job Cards`;

  const pagesHtml = preparedCards.map((item, idx) => {
    const { card, design1, design2, showTwoImages, img1, img2, candidates1, candidates2, qrDataUrl, challans } = item;
    const { rows: tpRows, totalMtr: finalTpTotal, challanNosStr, challanDetailsList, effectiveLotNo } = buildTpAndWasteGrid(challans, card);

    const freshNum = parseFloat(card.freshMtr) || parseFloat(finalTpTotal) || parseFloat(card.totalMtr) || 0;
    const wasteNum = parseFloat(card.totalWastageMtr) || 0;
    let recoveryHtml = '';
    if (freshNum > 0) {
      const totalUsed = freshNum + wasteNum;
      const yieldPct = ((freshNum / totalUsed) * 100).toFixed(1);
      recoveryHtml = `<div>📊 <strong>Fresh Recovery:</strong> <span style="color: #166534; font-weight: 800;">${yieldPct}%</span>`;
      if (card.shrinkagePct) recoveryHtml += ` | <strong>Avg Shrinkage:</strong> ${card.shrinkagePct}%`;
      recoveryHtml += `</div>`;
    }

    const pannaDisplay = card.panna ? (card.rawPanna ? `${card.panna} (Raw: ${card.rawPanna})` : card.panna) : (card.rawPanna || '');
    const fabricDisplay = `${card.fabric || ''}${card.fabricSource ? ` [${card.fabricSource}]` : ''}`;

    const c1Json = JSON.stringify(candidates1).replace(/"/g, '&quot;');
    const c2Json = JSON.stringify(candidates2).replace(/"/g, '&quot;');
    const alt1 = (design1 || 'Design 1').replace(/"/g, '&quot;');
    const alt2 = (design2 || 'Design 2').replace(/"/g, '&quot;');

    let imgAreaHtml = '';
    if (img1 && img2) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; border-right: 1.2px solid #000; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img1}" data-candidates="${c1Json}" data-candidate-index="0" alt="${alt1}" referrerpolicy="no-referrer" style="max-width: 100%; max-height: 136px; object-fit: contain;" onerror="handleCandidateError(this)" />
        </div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img2}" data-candidates="${c2Json}" data-candidate-index="0" alt="${alt2}" referrerpolicy="no-referrer" style="max-width: 100%; max-height: 136px; object-fit: contain;" onerror="handleCandidateError(this)" />
        </div>
      </div>`;
    } else if (img1) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img1}" data-candidates="${c1Json}" data-candidate-index="0" alt="${alt1}" referrerpolicy="no-referrer" style="max-width: 100%; max-height: 136px; object-fit: contain;" onerror="handleCandidateError(this)" />
        </div>
      </div>`;
    } else if (img2) {
      imgAreaHtml = `
      <div style="display: flex; width: 100%; border: 1.2px solid #000; height: 140px; margin-top: 1px;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
          <img src="${img2}" data-candidates="${c2Json}" data-candidate-index="0" alt="${alt2}" referrerpolicy="no-referrer" style="max-width: 100%; max-height: 136px; object-fit: contain;" onerror="handleCandidateError(this)" />
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

    const dateStr = card.date ? (card.date.includes('-') ? card.date.split('-').reverse().join('/') : card.date) : '';
    const printDateStr = card.printDate ? (card.printDate.includes('-') ? card.printDate.split('-').reverse().join('/') : card.printDate) : '';
    const isLast = idx === cards.length - 1;

    return `
    <div class="card-page ${!isLast ? 'page-break' : ''}">
      <div class="wrap">
      <!-- HEADER -->
      <div class="header">
        <div class="logo-box">
          <img src="${window.location.origin}/DigitalLogo.png" alt="Elite Digital Prints" style="height: 36px; object-fit: contain; filter: invert(0);">
        </div>
        <div class="center-box">
          <div class="center-title">ELITE DIGITAL</div>
          <div class="machine-box" style="background: ${card.machineName === 'GRANDO' ? '#0b5394' : card.machineName === 'PRINTDOT' ? '#cc0000' : '#fff'}; color: ${card.machineName ? '#fff' : '#000'};">
            ${card.machineName || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}
          </div>
        </div>
        <div class="qr-box-right">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR: Scan to view full Job Card" style="height: 40px; width: 40px; object-fit: contain;">` : ''}
        </div>
      </div>

      <!-- MAIN FIELDS TABLE -->
      <table style="margin-top:1px">
        <tr>
          <td class="label">JOB NO. :</td><td class="val">${card.jobNo || ''}</td>
          <td class="label">COLORS :</td><td class="val">${card.colors || ''}</td>
          <td class="label">DATE :</td><td class="val">${dateStr}</td>
        </tr>
        <tr>
          <td class="label">D. NO. :</td><td class="val">${cleanDesignNameString(card.designNo || card.designName || '')}</td>
          <td class="label">PANNA :</td><td class="val">${pannaDisplay}</td>
          <td class="label">PASS :</td><td class="val">${card.pass || ''}</td>
        </tr>
        <tr>
          <td class="label">FABRIC :</td><td class="val">${fabricDisplay}</td>
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
          <td class="label">PARTY:</td><td colspan="3" class="val" style="font-weight: 700;">${card.party || ''}</td>
          <td colspan="2" style="font-weight: 900; font-size: 11.5pt; padding-left: 10px;">: ${card.totalMtr || ''}</td>
        </tr>
        <tr>
          <td class="label">CLIENT PO :</td><td class="val" style="font-weight: 700; color: #0b5394;">${card.clientPoNo || card.poNo || '—'}</td>
          <td class="label">LOT NO. :</td><td class="val" style="font-weight: 700;">${card.lotNo || effectiveLotNo || '—'}</td>
          <td class="label">TARGET :</td><td class="val" style="font-weight: 700; color: #166534;">${card.targetDeliveryDate || '—'}</td>
        </tr>
      </table>

      ${imgAreaHtml}

      <div class="notes-container">
        <div class="note-row">NOTE 1 : ${card.note1 || ''}</div>
        <div class="note-row-emergency">EMRG. NOTE : ${card.emergencyNotes || ''}</div>
        <div class="note-row">NOTE 2 : ${card.note2 || ''}</div>
      </div>

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

      <table style="width: 100%; margin-top: 1px;">
        <tr>
          <td class="label" style="width: 15%;">OPERATER:</td>
          <td class="val" style="width: 35%;">${card.operatorName || ''}</td>
          <td class="label" style="width: 15%;">PRINT DATE :</td>
          <td class="val" style="width: 35%;">${printDateStr}</td>
        </tr>
        <tr>
          <td class="label">ROLL NO. :</td>
          <td class="val"></td>
          <td class="label">PRINT METER :</td>
          <td class="val" style="font-weight: 700;">${card.printMtr || ''}</td>
        </tr>
      </table>

      <table style="width: 100%; margin-top: 1px;">
        <tr>
          <td class="label" style="width: 15%; text-align: center; font-weight: 800;">FUSING</td>
          <td class="label" style="width: 15%;">TEMP. :</td>
          <td class="val" style="width: 20%; text-align: center; font-weight: 800;">${card.fusingTemp || card.temperature || ''}</td>
          <td class="label" style="width: 15%;">SPEED :</td>
          <td class="val" style="width: 35%; text-align: center; font-weight: 800;">${card.fusingSpeed || card.speed || ''}</td>
        </tr>
        <tr>
          <td class="label" style="text-align: center; font-weight: 800;">NAME:</td>
          <td class="val" colspan="2"></td>
          <td class="label">DATE :</td>
          <td class="val"></td>
        </tr>
      </table>

      <table class="tp-table">
        <tr>
          <th colspan="10" style="text-align: center; font-weight: 800;">T.P. METER</th>
          <th colspan="2" style="font-size: 6.5pt; font-weight: 800; line-height: 1.1; padding: 2px;">T.P.<br/>WESTAGE<br/>METER</th>
        </tr>
        <!-- Row 1 -->
        <tr>
          <td class="tp-label">1)</td><td class="tp-val">${tpRows[0][0].val}</td>
          <td class="tp-label">6)</td><td class="tp-val">${tpRows[0][1].val}</td>
          <td class="tp-label">11)</td><td class="tp-val">${tpRows[0][2].val}</td>
          <td class="tp-label">16)</td><td class="tp-val">${tpRows[0][3].val}</td>
          <td class="tp-label">20)</td><td class="tp-val">${tpRows[0][4].val}</td>
          <td class="tp-label" style="width: 25px;">1)</td><td class="tp-val tp-waste-val">${tpRows[0][5].wVal}</td>
        </tr>
        <!-- Row 2 -->
        <tr>
          <td class="tp-label">2)</td><td class="tp-val">${tpRows[1][0].val}</td>
          <td class="tp-label">7)</td><td class="tp-val">${tpRows[1][1].val}</td>
          <td class="tp-label">12)</td><td class="tp-val">${tpRows[1][2].val}</td>
          <td class="tp-label">17)</td><td class="tp-val">${tpRows[1][3].val}</td>
          <td class="tp-label">21)</td><td class="tp-val">${tpRows[1][4].val}</td>
          <td class="tp-label">2)</td><td class="tp-val tp-waste-val">${tpRows[1][5].wVal}</td>
        </tr>
        <!-- Row 3 -->
        <tr>
          <td class="tp-label">3)</td><td class="tp-val">${tpRows[2][0].val}</td>
          <td class="tp-label">8)</td><td class="tp-val">${tpRows[2][1].val}</td>
          <td class="tp-label">13)</td><td class="tp-val">${tpRows[2][2].val}</td>
          <td class="tp-label">18)</td><td class="tp-val">${tpRows[2][3].val}</td>
          <td class="tp-label">22)</td><td class="tp-val">${tpRows[2][4].val}</td>
          <td class="tp-label">3)</td><td class="tp-val tp-waste-val">${tpRows[2][5].wVal}</td>
        </tr>
        <!-- Row 4 -->
        <tr>
          <td class="tp-label">4)</td><td class="tp-val">${tpRows[3][0].val}</td>
          <td class="tp-label">9)</td><td class="tp-val">${tpRows[3][1].val}</td>
          <td class="tp-label">14)</td><td class="tp-val">${tpRows[3][2].val}</td>
          <td class="tp-label">19)</td><td class="tp-val">${tpRows[3][3].val}</td>
          <td class="tp-label">23)</td><td class="tp-val">${tpRows[3][4].val}</td>
          <td class="tp-label">${tpRows[3][5].wLbl}</td><td class="tp-val tp-waste-val">${tpRows[3][5].wVal}</td>
        </tr>
        <!-- Row 5 -->
        <tr>
          <td class="tp-label">5)</td><td class="tp-val">${tpRows[4][0].val}</td>
          <td class="tp-label">10)</td><td class="tp-val">${tpRows[4][1].val}</td>
          <td class="tp-label">15)</td><td class="tp-val">${tpRows[4][2].val}</td>
          <td colspan="3" style="font-weight: 800; font-size: 7.2pt; text-align: right; padding-right: 5px;">TOTAL :-</td>
          <td class="tp-val" style="font-weight: 900; color: #1e3a8a;">${finalTpTotal}</td>
          <td class="tp-label" style="font-weight: 800; font-size: 6.5pt;">${(tpRows[4][5] || tpRows[4][3])?.wLbl || ''}</td>
          <td class="tp-val tp-waste-val" style="font-weight: 900;">${(tpRows[4][5] || tpRows[4][3])?.wVal || ''}</td>
        </tr>
      </table>
      <div style="padding: 2px 4px; border: 1.2px solid #000; border-top: none; font-size: 6pt; color: #334155; background: #ffffff; display: flex; flex-direction: column; gap: 1px; line-height: 1.25;">
        ${recoveryHtml}
        ${challanDetailsList && challanDetailsList.length > 0 ? `<div><strong>Challan:</strong> ${challanDetailsList.map(c => {
          const cLink = c.rawNo ? `<a href="/verify/challan/${c.rawNo}" target="_blank" style="color: #0b5394; text-decoration: underline; font-weight: bold;">${c.cNo}</a>` : c.cNo;
          let invPart = 'Inv: --';
          if (c.invoiceNo) {
            invPart = `Inv: <a href="/verify/invoice/${encodeURIComponent(c.invoiceNo)}" target="_blank" style="color: #0b5394; text-decoration: underline; font-weight: bold;">${c.invoiceNo}</a>`;
          }
          const parts = [c.mtrStr, invPart].filter(Boolean).join(', ');
          return parts ? `${cLink} (${parts})` : cLink;
        }).join(', ')}</div>` : (challanNosStr ? `<div><strong>Challan:</strong> ${challanNosStr}</div>` : '')}
        <div><strong>*Wastage:</strong> <strong>FF:</strong> Fabric Fault | <strong>PF:</strong> Print Fault | <strong>FS:</strong> Fusing Fault | <strong>GF:</strong> Genuine Fault | <strong>CW:</strong> Challan Waste | <strong>TOT:</strong> Total Wastage</div>
      </div>
    </div>
  </div>`;
  }).join('\n');

  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${titleText}</title>
    <style>
      @page { size: A5 portrait; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page-break { page-break-after: always; break-after: page; }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
      body { background: #fff; color: #000; font-size: 8.5pt; line-height: 1.15; margin: 0; padding: 0; }
      .card-page { width: 100%; max-width: 136mm; margin: 0 auto; position: relative; }
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
      .qr-box-right {
        width: 52px;
        padding: 1px 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-left: 1.5px solid #000;
        background: #fff;
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
      .tp-ch-header { font-weight: 800; color: #1e3a8a; }
      .tp-waste-val { font-weight: 800; color: #b91c1c; font-size: 7.2pt; }

    </style>
    <script>
      function handleCandidateError(img) {
        try {
          var raw = img.getAttribute('data-candidates');
          if (!raw) return;
          var list = JSON.parse(raw);
          var idx = parseInt(img.dataset.candidateIndex || '0', 10) + 1;
          if (idx < list.length) {
            img.dataset.candidateIndex = idx;
            img.src = list[idx];
          } else {
            var base = img.alt || '';
            img.onerror = null;
            if (base) {
              img.src = '${window.location.origin}/v1/designs/' + encodeURIComponent(base) + '.jpg?fallback=1';
            }
          }
        } catch(e) {}
      }

      window.onload = function() {
        var imgs = Array.prototype.slice.call(document.getElementsByTagName('img'));
        var printed = false;
        function triggerPrint() {
          if (printed) return;
          printed = true;
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        }
        if (imgs.length === 0) {
          triggerPrint();
          return;
        }
        var timer = setTimeout(triggerPrint, 3500);
        var pending = imgs.length;
        function checkDone() {
          pending--;
          if (pending <= 0) {
            clearTimeout(timer);
            triggerPrint();
          }
        }
        imgs.forEach(function(img) {
          if (img.complete && img.naturalWidth > 0) {
            checkDone();
          } else {
            img.addEventListener('load', function() { checkDone(); });
            img.addEventListener('error', function() {
              setTimeout(function() {
                if (img.complete && img.naturalWidth > 0) {
                  checkDone();
                } else {
                  var maxIdx = 0;
                  try {
                    maxIdx = JSON.parse(img.getAttribute('data-candidates') || '[]').length;
                  } catch(e) {}
                  if (parseInt(img.dataset.candidateIndex || '0', 10) >= maxIdx) {
                    checkDone();
                  }
                }
              }, 400);
            });
          }
        });
      };
    </script>
  </head><body>
    ${pagesHtml}
  </body></html>`);
  win.document.close();
}

// ─── Image preview component with candidate fallback and zoom ───────────────
function SmartJobCardPreviewImage({ rawUrl, designName, label, onZoom }) {
  const candidates = useMemo(() => {
    return getImageCandidates(rawUrl, designName, { thumbnail: false, width: 800 });
  }, [rawUrl, designName]);

  const [candIndex, setCandIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCandIndex(0);
    setHasError(false);
  }, [rawUrl, designName]);

  const currentSrc = candidates[candIndex] || (rawUrl ? convertDriveUrl(rawUrl) : '');

  if (hasError || !currentSrc) {
    return (
      <div style={{
        flex: 1, minWidth: 160, minHeight: 140,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed var(--border-light)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0.75rem', gap: '0.4rem', color: 'var(--text-muted)'
      }}>
        <Image size={24} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{label || 'Design Artwork'}</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>No preview image</span>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1, minWidth: 160,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{
        position: 'absolute', top: 6, left: 6, zIndex: 2,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        color: '#fff', fontSize: '0.65rem', fontWeight: 700,
        padding: '2px 6px', borderRadius: 4, letterSpacing: '0.03em'
      }}>
        {label}
      </div>
      <div
        style={{
          height: 150, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', overflow: 'hidden'
        }}
        onClick={() => onZoom && onZoom(currentSrc)}
        title="Click to view high resolution image"
      >
        <img
          src={currentSrc}
          alt={label || 'Artwork'}
          referrerPolicy="no-referrer"
          onError={() => {
            if (candIndex + 1 < candidates.length) {
              setCandIndex(i => i + 1);
            } else {
              setHasError(true);
            }
          }}
          style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          borderRadius: 4, padding: '2px 6px', fontSize: '0.65rem',
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <ZoomIn size={11} /> Zoom
        </div>
      </div>
    </div>
  );
}

// ─── Modal section card helper ───────────────────────────────────────────────
function DetailCard({ title, icon: Icon, children, badge, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      padding: '0.85rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      ...style
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-light)', paddingBottom: '0.45rem'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
          textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          {Icon && <Icon size={14} />}
          <span>{title}</span>
        </div>
        {badge}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

// ─── Modal field cell helper ─────────────────────────────────────────────────
function DetailCell({ label, value, highlight, color, fullWidth, extra }) {
  const displayVal = value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : '—';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.45rem 0.65rem',
      minWidth: 0,
      gridColumn: fullWidth ? '1 / -1' : undefined
    }}>
      <div style={{
        fontSize: '0.62rem', color: 'var(--text-muted)',
        textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.85rem',
        fontWeight: highlight ? 700 : 600,
        color: color || (highlight ? 'var(--primary)' : 'var(--text-primary)'),
        wordBreak: 'break-word'
      }}>
        <span>{displayVal}</span>
        {extra}
      </div>
    </div>
  );
}

function JobCardPrintView({ card, onClose, onShare }) {
  if (!card) return null;

  const formatDateSafe = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString();
    } catch {
      return String(dateVal);
    }
  };

  const formatDateTimeSafe = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleString();
    } catch {
      return String(dateVal);
    }
  };

  const [resolvedImages, setResolvedImages] = useState({
    imageUrl1: card.imageUrl1 || '',
    imageUrl2: card.imageUrl2 || '',
  });
  const [zoomImage, setZoomImage] = useState(null);
  const [viewTab, setViewTab] = useState('all'); // 'all' | 'sheet' | 'tracking'
  const [challans, setChallans] = useState(card.challans || []);

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
        console.warn('Error fetching challans for JobCardPrintView:', e);
      }
    };
    fetchChallans();
    return () => { isMounted = false; };
  }, [card]);

  const { rows: tpRows, totalMtr: finalTpTotal, challanNosStr, challanDetailsList, effectiveLotNo } = buildTpAndWasteGrid(challans, card);

  useEffect(() => {
    const resolveImages = async () => {
      if (!card) return;

      const rawName = card.designName || card.designNo || '';
      const names = extractDesignNames(rawName);

      let img1 = card.imageUrl1 || '';
      let img2 = card.imageUrl2 || '';

      try {
        if (!img1 && names[0]) {
          const res1 = await api.getDesigns({ search: names[0], limit: 5 });
          if (res1 && res1.data && res1.data.length > 0) {
            const matched1 = res1.data.find(d =>
              d.designName?.toLowerCase() === names[0].toLowerCase() ||
              String(d.designNo || '').toLowerCase() === names[0].toLowerCase()
            ) || res1.data[0];
            const freshImg = matched1.imageUrl || matched1.imageUrl2 || '';
            if (freshImg) img1 = freshImg;
            if (!img2 && matched1.imageUrl2 && matched1.imageUrl !== matched1.imageUrl2) {
              img2 = matched1.imageUrl2;
            }
          }
        }

        if (!img2 && names.length > 1 && names[1]) {
          const res2 = await api.getDesigns({ search: names[1], limit: 5 });
          if (res2 && res2.data && res2.data.length > 0) {
            const matched2 = res2.data.find(d =>
              d.designName?.toLowerCase() === names[1].toLowerCase() ||
              String(d.designNo || '').toLowerCase() === names[1].toLowerCase()
            ) || res2.data[0];
            img2 = matched2.imageUrl || matched2.imageUrl2 || '';
          }
        }

        setResolvedImages({ imageUrl1: img1, imageUrl2: img2 });
      } catch (err) {
        console.error('Failed to resolve design images for preview:', err);
        setResolvedImages({
          imageUrl1: card.imageUrl1 || '',
          imageUrl2: (names.length >= 2) ? (card.imageUrl2 || '') : '',
        });
      }
    };
    resolveImages();
  }, [card]);

  const doPrint = () => {
    triggerJobCardPrint({
      ...card,
      lotNo: card.lotNo || effectiveLotNo || '',
      challans,
      imageUrl1: resolvedImages.imageUrl1 || card.imageUrl1,
      imageUrl2: resolvedImages.imageUrl2 || card.imageUrl2
    });
  };

  const primaryDesignName = cleanDesignNameString(card.designName || card.designNo || '');
  const colorHex = card.colors ? getColorHex(card.colors) : null;
  const machineBg = card.machineName === 'GRANDO' ? '#0b5394' : card.machineName === 'PRINTDOT' ? '#cc0000' : '#1e293b';

  const tdPrintLabel = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontWeight: 800,
    fontSize: '7.5pt',
    background: '#f8fafc',
    whiteSpace: 'nowrap',
    color: '#000'
  };

  const tdPrintVal = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '7.5pt',
    color: '#000'
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

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)'
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 980,
          width: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
          background: 'var(--bg-card, #131722)',
          border: '1px solid var(--border-light, #2e384d)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── MODAL HEADER ─── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.85rem 1.4rem', borderBottom: '1px solid var(--border-light)',
          background: 'rgba(255,255,255,0.02)', gap: '1rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)',
                fontFamily: 'monospace', letterSpacing: '0.04em'
              }}>
                JOB NO.- {card.jobNo}
              </span>
              {card.machineName && (
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: card.machineName === 'GRANDO' ? 'rgba(37,99,235,0.18)' : card.machineName === 'PRINTDOT' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.08)',
                  color: card.machineName === 'GRANDO' ? '#60a5fa' : card.machineName === 'PRINTDOT' ? '#f87171' : 'var(--text-primary)',
                  border: `1px solid ${card.machineName === 'GRANDO' ? 'rgba(96,165,250,0.3)' : card.machineName === 'PRINTDOT' ? 'rgba(248,113,113,0.3)' : 'var(--border-light)'}`
                }}>
                  {card.machineName}
                </span>
              )}
              <WorkflowStageBadge card={card} />
              <StatusPill status={card.status || 'Pending'} />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <span>Dept: <strong style={{ color: 'var(--text-primary)' }}>{card.department || 'digital_print'}</strong></span>
              {card.category && <span>Category: <strong style={{ color: 'var(--text-primary)' }}>{card.category}</strong></span>}
              <span>Created Date: <strong style={{ color: 'var(--text-primary)' }}>{card.date || '—'}</strong></span>
            </div>
          </div>

          {/* 🌟 VIEW MODE SELECTOR (Sheet vs Tracking vs All) 🌟 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '3px',
              borderRadius: '8px', border: '1px solid var(--border-light)'
            }}>
              <button
                type="button"
                onClick={() => setViewTab('all')}
                style={{
                  padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: '6px',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: viewTab === 'all' ? 'var(--primary)' : 'transparent',
                  color: viewTab === 'all' ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                📑 All Information
              </button>
              <button
                type="button"
                onClick={() => setViewTab('sheet')}
                style={{
                  padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: '6px',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: viewTab === 'sheet' ? 'var(--primary)' : 'transparent',
                  color: viewTab === 'sheet' ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                📄 Authentic Print Card
              </button>
              <button
                type="button"
                onClick={() => setViewTab('tracking')}
                style={{
                  padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: '6px',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: viewTab === 'tracking' ? 'var(--primary)' : 'transparent',
                  color: viewTab === 'tracking' ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                📊 Department Tracking
              </button>
            </div>

            <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%', padding: '0.45rem' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── MODAL SCROLLABLE BODY ─── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '1.2rem 1.4rem',
          display: 'flex', flexDirection: 'column', gap: '1.2rem'
        }}>
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 📄 VIEW MODE 1: AUTHENTIC PHYSICAL JOB CARD (EXACT PRINT REPLICA)    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {(viewTab === 'all' || viewTab === 'sheet') && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              width: '100%', background: 'rgba(0,0,0,0.2)', padding: '1rem',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', maxWidth: '580px', marginBottom: '8px'
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📄 Authentic Physical Job Card Sheet (Print Layout)
                </div>
                <button
                  onClick={doPrint}
                  style={{
                    background: '#2563eb', color: '#fff', border: 'none',
                    padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem',
                    fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Printer size={12} /> Print Physical Sheet
                </button>
              </div>

              {/* Exact Physical Paper Replica Card */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '580px',
                  background: '#ffffff',
                  color: '#000000',
                  padding: '12px 14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                  boxSizing: 'border-box',
                  borderRadius: '3px',
                  border: '1.2px solid #000'
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
                    style={{ height: '32px', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11pt', fontWeight: 900, letterSpacing: '1px', color: '#000' }}>
                      ELITE DIGITAL PRINTS
                    </div>
                    <div
                      style={{
                        background: machineBg,
                        color: '#ffffff',
                        display: 'inline-block',
                        padding: '1px 14px',
                        fontSize: '9pt',
                        fontWeight: 800,
                        marginTop: '2px',
                        borderRadius: '2px',
                      }}
                    >
                      {card?.machineName || 'MACHINE'}
                    </div>
                  </div>
                  <JobCardQrBadge card={card} size={32} />
                </div>

                {/* Main 18-Specification Grid Table */}
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
                      <td style={tdPrintLabel}>JOB NO. :</td>
                      <td style={{ ...tdPrintVal, fontWeight: 900, fontSize: '9.5pt', color: '#0b5394' }}>{card?.jobNo || ''}</td>
                      <td style={tdPrintLabel}>COLORS :</td>
                      <td style={tdPrintVal}>{card?.colors || card?.colourMatching || ''}</td>
                      <td style={tdPrintLabel}>DATE :</td>
                      <td style={tdPrintVal}>{card?.date || ''}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>D. NO. :</td>
                      <td style={{ ...tdPrintVal, fontWeight: 800 }}>{primaryDesignName || card?.designNo || ''}</td>
                      <td style={tdPrintLabel}>PANNA :</td>
                      <td style={tdPrintVal}>
                        {card?.panna ? `${card.panna}${card.rawPanna ? ` (Raw: ${card.rawPanna})` : ''}` : (card?.rawPanna ? `Raw: ${card.rawPanna}` : '')}
                      </td>
                      <td style={tdPrintLabel}>PASS :</td>
                      <td style={tdPrintVal}>{card?.pass || ''}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>FABRIC :</td>
                      <td style={{ ...tdPrintVal, fontWeight: 700 }}>
                        {card?.fabric || ''}{card?.fabricSource ? ` [${card.fabricSource}]` : ''}
                      </td>
                      <td style={tdPrintLabel}>CON. :</td>
                      <td style={tdPrintVal}>{card?.consumption || ''}</td>
                      <td style={tdPrintLabel}>ALL OVER :</td>
                      <td style={tdPrintVal}>{card?.allover || ''}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>PCS :</td>
                      <td style={tdPrintVal}>{card?.pcs || ''}</td>
                      <td style={tdPrintLabel}>BOTTOM :</td>
                      <td style={tdPrintVal}>{card?.bottom || ''}</td>
                      <td style={tdPrintLabel}>PN/KM :</td>
                      <td style={tdPrintVal}>{card?.pnKm || ''}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>TOP :</td>
                      <td style={tdPrintVal}>{card?.top || ''}</td>
                      <td style={tdPrintLabel}>DUPATTA :</td>
                      <td style={tdPrintVal}>{card?.dupatta || ''}</td>
                      <td style={tdPrintLabel}>SET-COPY :</td>
                      <td style={tdPrintVal}>{card?.setCopy || ''}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>SLEEVE :</td>
                      <td style={tdPrintVal}>{card?.sleeve || ''}</td>
                      <td style={tdPrintLabel}>CUT :</td>
                      <td style={tdPrintVal}>{card?.cut || ''}</td>
                      <td colSpan={2} style={{ ...tdPrintVal, textAlign: 'center', background: '#f1f5f9', fontWeight: 800, fontSize: '8pt' }}>
                        TOTAL MTR
                      </td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>PARTY:</td>
                      <td colSpan={3} style={{ ...tdPrintVal, fontWeight: 800, fontSize: '9pt' }}>
                        {card?.party || ''}
                      </td>
                      <td colSpan={2} style={{ ...tdPrintVal, fontWeight: 900, fontSize: '11pt', paddingLeft: '8px', color: '#166534' }}>
                        : {card?.totalMtr || '0'} Mtr
                      </td>
                    </tr>
                    {(card?.clientPoNo || card?.poNo || card?.lotNo || effectiveLotNo || card?.targetDeliveryDate) && (
                      <tr>
                        <td style={tdPrintLabel}>CLIENT PO :</td>
                        <td style={{ ...tdPrintVal, fontWeight: 700, color: '#0369a1' }}>
                          {card?.clientPoNo || card?.poNo || '—'}
                        </td>
                        <td style={tdPrintLabel}>LOT NO. :</td>
                        <td style={{ ...tdPrintVal, fontWeight: 700, color: '#4338ca' }}>
                          {card?.lotNo || effectiveLotNo || '—'}
                        </td>
                        <td style={tdPrintLabel}>TARGET :</td>
                        <td style={{ ...tdPrintVal, fontWeight: 700, color: '#b45309' }}>
                          {card?.targetDeliveryDate ? String(card.targetDeliveryDate).split('T')[0] : '—'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Design Image Area */}
                <div
                  style={{
                    width: '100%',
                    border: '1.2px solid #000',
                    marginTop: '2px',
                    minHeight: '130px',
                    maxHeight: '190px',
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
                        <div
                          style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', minHeight: '130px', cursor: 'zoom-in' }}
                          onClick={() => setZoomImage(resolvedImages.imageUrl1)}
                          title="Click to Zoom Artwork 1"
                        >
                          <img
                            src={resolvedImages.imageUrl1}
                            alt="Design Artwork 1"
                            referrerPolicy="no-referrer"
                            style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }}
                            onError={(e) => {
                              const cands = getImageCandidates(resolvedImages.imageUrl1, primaryDesignName);
                              if (cands.length > 1 && e.currentTarget.src !== cands[1]) {
                                e.currentTarget.src = cands[1];
                              }
                            }}
                          />
                        </div>
                      )}
                      {resolvedImages.imageUrl2 && (
                        <div
                          style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderLeft: '1.2px solid #000', minHeight: '130px', cursor: 'zoom-in' }}
                          onClick={() => setZoomImage(resolvedImages.imageUrl2)}
                          title="Click to Zoom Artwork 2"
                        >
                          <img
                            src={resolvedImages.imageUrl2}
                            alt="Design Artwork 2"
                            referrerPolicy="no-referrer"
                            style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '8pt', padding: '1rem' }}>
                      <ImageIcon size={22} style={{ margin: '0 auto 4px', opacity: 0.5 }} />
                      <div>{primaryDesignName || 'NO DESIGN IMAGE ATTACHED'}</div>
                    </div>
                  )}
                </div>

                {/* Notes Container */}
                <div
                  style={{
                    border: '1.2px solid #000',
                    marginTop: '2px',
                    fontSize: '7.5pt',
                    fontWeight: 700,
                    lineHeight: '1.25',
                  }}
                >
                  <div style={{ padding: '2px 6px', borderBottom: '1px solid #e2e8f0', color: '#000' }}>
                    NOTE 1 : {card?.note1 || '—'}
                  </div>
                  {card?.emergencyNotes && (
                    <div style={{ padding: '2px 6px', background: '#fef2f2', color: '#b91c1c', borderBottom: '1px solid #fecaca', fontWeight: 800 }}>
                      EMRG. NOTE : {card.emergencyNotes}
                    </div>
                  )}
                  <div style={{ padding: '2px 6px', color: '#000' }}>
                    NOTE 2 : {card?.note2 || '—'}
                  </div>
                </div>

                {/* Printing Specs Table 1 */}
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
                      <td style={{ ...tdPrintLabel, width: '18%' }}>DESIGNER :</td>
                      <td style={{ ...tdPrintVal, width: '32%' }}>{card?.designer || '—'}</td>
                      <td style={{ ...tdPrintLabel, width: '18%' }}>C. M. :</td>
                      <td style={{ ...tdPrintVal, width: '32%' }}>{card?.colourMatching || '—'}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>EXP. TIME :</td>
                      <td style={{ ...tdPrintVal, fontWeight: 700, color: '#0b5394' }}>{card?.expTime || '—'}</td>
                      <td style={tdPrintLabel}>PAPER TYPE :</td>
                      <td style={tdPrintVal}>{card?.paperType || '—'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Printing & Operator Table 2 */}
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
                      <td style={{ ...tdPrintLabel, width: '18%' }}>OPERATOR :</td>
                      <td style={{ ...tdPrintVal, width: '32%' }}>{card?.operatorName || '—'}</td>
                      <td style={{ ...tdPrintLabel, width: '18%' }}>PRINT DATE :</td>
                      <td style={{ ...tdPrintVal, width: '32%' }}>{card?.printDate || '—'}</td>
                    </tr>
                    <tr>
                      <td style={tdPrintLabel}>ROLL NO. :</td>
                      <td style={tdPrintVal}>{card?.rollNo || '—'}</td>
                      <td style={tdPrintLabel}>PRINT METER :</td>
                      <td style={{ ...tdPrintVal, fontWeight: 800, color: '#2563eb' }}>{card?.printMtr ? `${card.printMtr} Mtr` : '—'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Fusing & Heat Press Table 3 */}
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
                      <td style={{ ...tdPrintLabel, width: '18%', textAlign: 'center', fontWeight: 900 }}>FUSING</td>
                      <td style={{ ...tdPrintLabel, width: '14%' }}>TEMP. :</td>
                      <td style={{ ...tdPrintVal, width: '18%', textAlign: 'center', fontWeight: 800 }}>{card?.fusingTemp || card?.temperature || '—'}</td>
                      <td style={{ ...tdPrintLabel, width: '14%' }}>SPEED :</td>
                      <td style={{ ...tdPrintVal, width: '36%', textAlign: 'center', fontWeight: 800 }}>{card?.fusingSpeed || card?.speed || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ ...tdPrintLabel, textAlign: 'center', fontWeight: 800 }}>NAME:</td>
                      <td style={tdPrintVal} colSpan={2}>{card?.fusingOperator || ''}</td>
                      <td style={tdPrintLabel}>DATE :</td>
                      <td style={tdPrintVal}>{card?.fusingDate || ''}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 🌟 FULL T.P. METER & T.P. WASTAGE METER TABLE (24 Slots) 🌟 */}
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
                  {(() => {
                    const freshNum = parseFloat(card?.freshMtr) || parseFloat(finalTpTotal) || parseFloat(card?.totalMtr) || 0;
                    const wasteNum = parseFloat(card?.totalWastageMtr) || 0;
                    if (freshNum > 0) {
                      const totalUsed = freshNum + wasteNum;
                      const yieldPct = ((freshNum / totalUsed) * 100).toFixed(1);
                      return (
                        <div>
                          📊 <strong>Fresh Recovery:</strong> <span style={{ color: '#166534', fontWeight: 800 }}>{yieldPct}%</span>
                          {card?.shrinkagePct ? ` | Avg Shrinkage: ${card.shrinkagePct}%` : ''}
                        </div>
                      );
                    }
                    return null;
                  })()}
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
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 📊 VIEW MODE 2: ALL SYSTEM & DEPARTMENT TRACKING DETAILS            */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {(viewTab === 'all' || viewTab === 'tracking') && (
            <>
              {/* Section Divider if showing both */}
              {viewTab === 'all' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  margin: '0.4rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                  <span>📊 System Database & Department Operations Tracking</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                </div>
              )}

              {/* Top Visual Overview Banner (Artwork Images & Essential Identifiers) */}
              <div style={{
                display: 'flex', gap: '1.2rem', flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)', padding: '1rem', alignItems: 'stretch'
              }}>
                {/* Artwork Previews */}
                <div style={{ display: 'flex', gap: '0.75rem', flex: '1 1 320px', minWidth: 260 }}>
                  <SmartJobCardPreviewImage
                    rawUrl={resolvedImages.imageUrl1 || card.imageUrl1}
                    designName={primaryDesignName}
                    label="Artwork 1 (Primary)"
                    onZoom={setZoomImage}
                  />
                  {(resolvedImages.imageUrl2 || card.imageUrl2) && (
                    <SmartJobCardPreviewImage
                      rawUrl={resolvedImages.imageUrl2 || card.imageUrl2}
                      designName={primaryDesignName}
                      label="Artwork 2 / Back"
                      onZoom={setZoomImage}
                    />
                  )}
                </div>

                {/* Quick Hero Highlights */}
                <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                      PARTY NAME
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      {card.party || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                      DESIGN NAME / NUMBER
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                      {primaryDesignName || '—'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginTop: 4 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>TOTAL METERS</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>{card.totalMtr || '0'} m</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>FABRIC</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{card.fabric || '—'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>COLORS</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {colorHex && (
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: colorHex, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block' }} />
                        )}
                        <span>{card.colors || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🚨 Emergency Notes Alert Banner (if present) 🚨 */}
              {card.emergencyNotes && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)', border: '1.5px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                  <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      URGENT / EMERGENCY INSTRUCTION
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fca5a5', marginTop: 2 }}>
                      {card.emergencyNotes}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SECTION: 🎯 PRODUCTION STAGE & PROOFING ─── */}
              {(card.productionStage || card.proofing?.approvalStatus || card.proofing?.artworkUrl) && (
                <DetailCard title="Production Stage & Proofing" icon={Activity}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell label="Production Stage" value={card.productionStage || 'Order Received'} highlight />
                    <DetailCell label="Proofing Approval" value={card.proofing?.approvalStatus || 'Pending'} />
                    {card.proofing?.approvedAt && (
                      <DetailCell label="Proofing Approved On" value={formatDateSafe(card.proofing.approvedAt)} />
                    )}
                    {card.proofing?.artworkFileName && (
                      <DetailCell label="Proofing Artwork File" value={card.proofing.artworkFileName} />
                    )}
                    {card.proofing?.clientFeedback && (
                      <DetailCell label="Client Feedback" value={card.proofing.clientFeedback} fullWidth />
                    )}
                  </div>
                </DetailCard>
              )}

              {/* ─── SECTION: 📐 PRINT SPECIFICATIONS & COSTING (MODULE 1) ─── */}
              {card.printSpecifications && (card.printSpecifications.width > 0 || card.printSpecifications.totalSqFt > 0) && (
                <DetailCard title="Print Dimensions & Costing Specs" icon={SlidersHorizontal}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell
                      label="Dimensions"
                      value={`${card.printSpecifications.width || 0} × ${card.printSpecifications.height || 0} ${card.printSpecifications.dimensionsUnit || 'inch'}`}
                      highlight
                    />
                    <DetailCell label="Total Sq. Ft." value={card.printSpecifications.totalSqFt ? `${card.printSpecifications.totalSqFt} sq ft` : '—'} />
                    <DetailCell label="Total Sq. Mtr." value={card.printSpecifications.totalSqMtr ? `${card.printSpecifications.totalSqMtr} sq m` : '—'} />
                    <DetailCell label="Material Type" value={card.printSpecifications.materialType || 'Sublimation'} />
                    <DetailCell label="Resolution Pass" value={card.printSpecifications.resolutionPass || '4 Pass'} />
                    <DetailCell label="Wastage Factor" value={`${card.printSpecifications.wastageFactorPct || 5}%`} />
                    {card.printSpecifications.totalCalculatedCost > 0 && (
                      <DetailCell label="Calculated Cost" value={`₹${card.printSpecifications.totalCalculatedCost}`} highlight color="#10b981" />
                    )}
                  </div>
                </DetailCard>
              )}

              {/* ─── SECTION: 📋 GENERAL & PARTY DETAILS ─── */}
              <DetailCard title="General & Party Information" icon={Building2}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                  <DetailCell label="Party Name" value={card.party} highlight />
                  <DetailCell label="Bill To" value={card.billTo} />
                  <DetailCell label="Ship To" value={card.shipTo} />
                  <DetailCell label="Bill / Challan No" value={card.billNo || card.partyChallan || card.ourChallanNo} />
                  <DetailCell label="Designer" value={card.designer} />
                  <DetailCell label="Colour Matching (C.M.)" value={card.colourMatching} />
                  <DetailCell
                    label="Color"
                    value={card.colors}
                    extra={colorHex ? <span style={{ width: 12, height: 12, borderRadius: '50%', background: colorHex, border: '1px solid rgba(255,255,255,0.3)' }} /> : null}
                  />
                  <DetailCell label="Category" value={card.category} />
                  <DetailCell label="Department" value={card.department || 'digital_print'} />
                  <DetailCell label="Order / Job Date" value={card.date} />
                  <DetailCell label="Job No" value={card.jobNo} highlight />
                </div>
              </DetailCard>

              {/* ─── SECTION: ✂️ FABRIC & CUTTING / GARMENT SPECS ─── */}
              <DetailCard title="Fabric, Cutting & Garment Breakdown" icon={Scissors}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                  <DetailCell label="Fabric" value={card.fabric} highlight />
                  <DetailCell label="Panna (Width)" value={card.panna} />
                  <DetailCell label="Total Meters" value={card.totalMtr ? `${card.totalMtr} m` : '—'} highlight color="#10b981" />
                  <DetailCell label="Pieces (Pcs)" value={card.pcs} />
                  <DetailCell label="Cut" value={card.cut} />
                  <DetailCell label="Allover" value={card.allover} />
                  <DetailCell label="Consumption (Con.)" value={card.consumption} />
                  <DetailCell label="Top" value={card.top} />
                  <DetailCell label="Sleeve" value={card.sleeve} />
                  <DetailCell label="Bottom" value={card.bottom} />
                  <DetailCell label="Dupatta" value={card.dupatta} />
                  <DetailCell label="Set Copy" value={card.setCopy} />
                  <DetailCell label="PN / KM" value={card.pnKm} />
                </div>

                {/* Garment Size Ratios (if present) */}
                {card.size_ratios && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Garment Size Ratio Breakdown (Total: {card.total_pieces || card.pcs || 0} Pcs)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))', gap: '0.4rem' }}>
                      {Object.entries(card.size_ratios).map(([sizeKey, count]) => (
                        <div key={sizeKey} style={{
                          background: 'rgba(255,255,255,0.02)', padding: '0.3rem 0.5rem',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {sizeKey.replace('_', ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {count || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DetailCard>

              {/* ─── 2-COLUMN ROW: PRINTING DEPT & FUSING DEPT ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.1rem' }}>
                {/* 🖨️ Printing Department */}
                <DetailCard
                  title="Printing Department"
                  icon={Printer}
                  badge={<StatusPill status={card.printStatus || 'Printing Pending'} />}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell label="Print Machine" value={card.machineName} highlight />
                    <DetailCell label="Operator" value={card.operatorName} />
                    <DetailCell label="Pass" value={card.pass} />
                    <DetailCell label="Speed" value={card.speed} />
                    <DetailCell label="EXP. Time" value={card.expTime} highlight />
                    <DetailCell label="Profile" value={card.profile} />
                    <DetailCell label="Paper Type" value={card.paperType} />
                    <DetailCell label="Print Date" value={card.printDate} />
                    <DetailCell label="Roll No" value={card.rollNo} />
                    <DetailCell label="Print Meter" value={card.printMtr ? `${card.printMtr} m` : '—'} highlight color="#3b82f6" />
                  </div>
                </DetailCard>

                {/* 🔥 Fusing & Heat Press */}
                <DetailCard
                  title="Fusing & Heat Press"
                  icon={Flame}
                  badge={<StatusPill status={card.fusingStatus || 'Fusing Pending'} />}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell label="Fusing Machine" value={card.fusingMachine} />
                    <DetailCell label="Fusing Operator" value={card.fusingOperator} />
                    <DetailCell label="Temperature" value={card.temperature || card.fusingTemp} highlight />
                    <DetailCell label="Fusing Speed" value={card.fusingSpeed || card.speed} />
                    <DetailCell label="Butter Paper Wt" value={card.butterPaperWeightKg ? `${card.butterPaperWeightKg} Kg` : '—'} />
                    <DetailCell label="Shift" value={card.shift} />
                    <DetailCell label="Fusing Date" value={card.fusingDate} />
                    <DetailCell label="Fusing Meter" value={card.fusingMtr ? `${card.fusingMtr} m` : '—'} highlight color="#f59e0b" />
                  </div>
                </DetailCard>
              </div>

              {/* ─── 2-COLUMN ROW: QUALITY ASSURANCE & DELIVERY/BILLING ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.1rem' }}>
                {/* 🛡️ Quality Assurance (QA) & Wastage */}
                <DetailCard
                  title="Quality Assurance & Wastage"
                  icon={ShieldCheck}
                  badge={<StatusPill status={card.qaStatus || 'QA Pending'} />}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell label="QA Inspector" value={card.qaInspector} />
                    <DetailCell label="QA Date" value={card.qaDate} />
                    <DetailCell label="Fresh Mtr (Passed)" value={card.freshMtr ? `${card.freshMtr} m` : '—'} highlight color="#10b981" />
                    <DetailCell label="Total Wastage" value={card.totalWastageMtr ? `${card.totalWastageMtr} m` : '0 m'} color="#ef4444" />
                    <DetailCell label="Fabric Fault" value={card.fabricFaultMtr ? `${card.fabricFaultMtr} m` : '0 m'} />
                    <DetailCell label="Print Fault" value={card.printFaultMtr ? `${card.printFaultMtr} m` : '0 m'} />
                    <DetailCell label="Fusing Fault" value={card.fusingFaultMtr ? `${card.fusingFaultMtr} m` : '0 m'} />
                    <DetailCell label="Genuine Fault" value={card.genuineFaultMtr ? `${card.genuineFaultMtr} m` : '0 m'} />
                    <DetailCell label="Total Fabric Used" value={card.totalFabricUsedMtr ? `${card.totalFabricUsedMtr} m` : '—'} />
                    {card.qaNotes && (
                      <DetailCell label="QA Notes / Remarks" value={card.qaNotes} fullWidth />
                    )}
                  </div>
                </DetailCard>

                {/* 🚚 Delivery & Billing */}
                <DetailCard
                  title="Delivery, Dispatch & Billing"
                  icon={Truck}
                  badge={<StatusPill status={card.deliveryStatus || 'Delivery Pending'} />}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                    <DetailCell label="Delivery Status" value={card.deliveryStatus || 'Delivery Pending'} />
                    <DetailCell label="Delivery Date" value={card.deliveryDate || card.dispatchDate} />
                    <DetailCell label="Delivered Mtr" value={card.deliveredMtr || card.deliveryMtr ? `${card.deliveredMtr || card.deliveryMtr} m` : '0 m'} highlight color="#065f46" />
                    <DetailCell label="Remaining Mtr" value={card.totalMtr ? `${Math.max(0, parseFloat(card.totalMtr || 0) - parseFloat(card.deliveredMtr || 0)).toFixed(2)} m` : '—'} />
                  </div>

                  {/* Linked Invoices */}
                  {card.invoices && card.invoices.length > 0 && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        Linked Invoices ({card.invoices.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {card.invoices.map((inv, idx) => (
                          <div key={idx} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                            fontSize: '0.78rem'
                          }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{inv.invoiceNo || `Invoice #${idx+1}`}</span>
                            <span>{inv.meters || 0} m</span>
                            <span style={{ fontWeight: 700 }}>₹{inv.amount || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </DetailCard>
              </div>

              {/* ─── SECTION: 📝 NOTES & INSTRUCTIONS ─── */}
              {(card.note1 || card.note2 || card.emergencyNotes) && (
                <DetailCard title="Special Notes & Remarks" icon={FileText}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.6rem' }}>
                    {card.note1 && <DetailCell label="Note 1" value={card.note1} />}
                    {card.emergencyNotes && <DetailCell label="Emergency Note" value={card.emergencyNotes} highlight color="#ef4444" />}
                    {card.note2 && <DetailCell label="Note 2" value={card.note2} />}
                  </div>
                </DetailCard>
              )}

              {/* ─── SECTION: 👤 AUDIT TRAIL & SYSTEM METADATA ─── */}
              <DetailCard title="Audit History & System Metadata" icon={Clock}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.6rem' }}>
                  <DetailCell label="Created By" value={card.createdByName || card.createdBy || 'Admin'} />
                  <DetailCell label="Created Date / Time" value={formatDateTimeSafe(card.created_date_time)} />
                  <DetailCell label="Last Updated By" value={card.updatedByName || card.updatedBy || 'System'} />
                  <DetailCell label="Modified Date / Time" value={formatDateTimeSafe(card.modified_date_time)} />
                  <DetailCell label="Version" value={`v${card.version || 1}`} />
                  {card.orderChatRoomId && (
                    <DetailCell label="Connected Chat Channel" value="Active Channel Linked" color="#60a5fa" />
                  )}
                </div>

                {/* Audit Trail Log History */}
                {Array.isArray(card.auditTrail) && card.auditTrail.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Change Log / History ({card.auditTrail.length} Events)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '140px', overflowY: 'auto' }}>
                      {card.auditTrail.map((ev, i) => (
                        <div key={i} style={{
                          fontSize: '0.74rem', background: 'rgba(255,255,255,0.015)',
                          padding: '0.35rem 0.55rem', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)', display: 'flex',
                          justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap'
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {ev.action || 'UPDATE'} • {ev.performedByName || ev.performedBy || 'Staff'}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {formatDateTimeSafe(ev.timestamp)}
                          </span>
                          {ev.details && (
                            <div style={{ width: '100%', color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.7rem' }}>
                              {ev.details}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DetailCard>
            </>
          )}
        </div>

        {/* ─── MODAL FOOTER ACTIONS ─── */}
        <div style={{
          display: 'flex', gap: '0.75rem', padding: '0.85rem 1.4rem',
          borderTop: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)',
          justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center'
        }}>
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.2rem', fontWeight: 700 }}
            onClick={doPrint}
          >
            <Printer size={15}/> Print / Save as PDF
          </button>
          {onShare && (
            <button
              className="btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.1rem',
                color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)', fontWeight: 600
              }}
              onClick={() => onShare(card)}
            >
              <Send size={15}/> Share to Chat
            </button>
          )}
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.1rem' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* ─── IMAGE FULL-SCREEN ZOOM OVERLAY MODAL ─── */}
      {zoomImage && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1250,
            background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem'
          }}
          onClick={() => setZoomImage(null)}
        >
          <div style={{
            position: 'absolute', top: 16, right: 16, display: 'flex', gap: '0.5rem', zIndex: 10
          }}>
            <a
              href={zoomImage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={14} style={{ marginRight: 4 }} /> Open in New Tab
            </a>
            <button
              onClick={() => setZoomImage(null)}
              className="btn-icon"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', padding: '0.45rem' }}
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={zoomImage}
            alt="Zoomed Design"
            referrerPolicy="no-referrer"
            style={{
              maxWidth: '92vw', maxHeight: '86vh', objectFit: 'contain',
              borderRadius: 'var(--radius-md)', boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
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
                inputMode={type === 'number' ? (name.toLowerCase().includes('mtr') || name.toLowerCase().includes('price') || name.toLowerCase().includes('panna') ? 'decimal' : 'numeric') : undefined}
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
            <input 
              type={type} 
              inputMode={type === 'number' ? (name.toLowerCase().includes('mtr') || name.toLowerCase().includes('price') || name.toLowerCase().includes('panna') ? 'decimal' : 'numeric') : undefined}
              name={name} 
              value={form[name]} 
              onChange={onChange} 
              readOnly={readOnly}
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

// ─── Image URL field with live preview / direct upload ─────────────────────────
function ImageField({ label, name, form, onChange, index, value, placeholder = "Paste Google Drive or image URL..." }) {
  const raw = (form && name in form) ? (form[name] || '') : (value || '');
  const [mode, setMode] = useState(raw && !raw.startsWith('data:') ? 'url' : 'file'); // 'file' or 'url'
  const fileInputRef = useRef(null);

  // Keep mode in sync when raw value is set programmatically (e.g. when selecting a Design No. from autocomplete)
  useEffect(() => {
    if (raw && !raw.startsWith('data:')) {
      setMode('url');
    } else if (raw && raw.startsWith('data:')) {
      setMode('file');
    }
  }, [raw]);

  const processAndUploadFile = async (file) => {
    if (!file) return;
    try {
      // 1. Convert file to compressed Base64 immediately so preview loads 100% instantly
      const base64 = await compressAndConvertToBase64(file);
      onChange({ target: { name, value: base64 } });

      // 2. Try background server upload
      try {
        const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const res = await api.uploadImage(compressedFile);
        if (res && res.url) {
          onChange({ target: { name, value: res.url } });
        }
      } catch (uploadErr) {
        console.warn('[ImageField] Background server upload warning:', uploadErr.message);
      }
    } catch (err) {
      alert('Failed to process image file: ' + err.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    await processAndUploadFile(file);
  };

  const handleClear = () => {
    onChange({ target: { name, value: '' } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isBase64 = raw.startsWith('data:');
  const directUrl = isBase64 ? raw : convertDriveUrl(raw);

  const handleImgError = (e) => {
    const currentSrc = e.target.src || '';
    if (!e.target.dataset.retried) {
      e.target.dataset.retried = '1';
      if (currentSrc.endsWith('.jpg')) {
        e.target.src = currentSrc.slice(0, -4) + '.jpeg';
        return;
      } else if (currentSrc.endsWith('.jpeg')) {
        e.target.src = currentSrc.slice(0, -5) + '.jpg';
        return;
      } else if (currentSrc.endsWith('.png')) {
        e.target.src = currentSrc.slice(0, -4) + '.jpeg';
        return;
      } else if (!currentSrc.includes('.')) {
        e.target.src = currentSrc + '.jpeg';
        return;
      }
    } else if (e.target.dataset.retried === '1') {
      e.target.dataset.retried = '2';
      if (currentSrc.endsWith('.jpeg')) {
        e.target.src = currentSrc.slice(0, -5) + '.png';
        return;
      } else if (currentSrc.endsWith('.jpg')) {
        e.target.src = currentSrc.slice(0, -4) + '.png';
        return;
      }
    }
    if (raw && (raw.includes('drive.google.com') || raw.includes('googleusercontent'))) {
      const idMatch = raw.match(/\/d\/([-\w]{20,})/) || raw.match(/[?&]id=([-\w]{20,})/) || raw.match(/([-\w]{25,})/);
      if (idMatch && idMatch[1]) {
        const fid = idMatch[1];
        if (currentSrc.includes('lh3.googleusercontent.com')) {
          e.target.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w1000`;
          return;
        } else if (currentSrc.includes('thumbnail?id=')) {
          e.target.src = `https://drive.google.com/uc?export=view&id=${fid}`;
          return;
        }
      }
    }
    e.target.style.display = 'none';
  };

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
          {mode === 'file' ? 'Paste Image URL instead' : 'Upload Image File instead'}
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
              await processAndUploadFile(file);
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
          {directUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={directUrl}
                alt={`Selected preview ${index || ''}`}
                referrerPolicy="no-referrer"
                style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                onError={handleImgError}
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
                  borderRadius: '50%', width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <Image size={24} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Drag & Drop or <strong style={{ color: 'var(--primary)' }}>Browse</strong> to upload image
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                Supports JPG, PNG (automatically compressed client-side)
              </span>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input
            type="text"
            name={name}
            value={raw}
            onChange={onChange}
            placeholder={placeholder}
            style={{
              padding: '0.5rem 0.7rem', fontSize: '0.82rem', fontWeight: 500,
              borderColor: directUrl ? 'rgba(52,211,153,0.4)' : undefined
            }}
          />
          {raw.includes('/folders/') && (
            <div style={{ fontSize: '0.7rem', color: 'var(--warning)', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              ⚠️ Folder link detected. Copy direct link of individual files in Drive instead.
            </div>
          )}
          {directUrl && (
            <div style={{
              display: 'inline-flex',
              gap: '0.8rem',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.02)',
              padding: '0.5rem',
              position: 'relative'
            }}>
              <img
                src={directUrl}
                alt={`Image ${index || ''} preview`}
                referrerPolicy="no-referrer"
                style={{ height: '70px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', background: '#f8fafc' }}
                onError={handleImgError}
              />
              <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.6rem',
                background: 'rgba(52,211,153,0.2)', color: '#34d399', padding: '1px 5px',
                borderRadius: 4, fontWeight: 700 }}>✓ Preview OK</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── JOB CARD FORM MODAL ─────────────────────────────────────────────────────
function JobCardForm({ card, onSave, onClose, department }) {
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
  const userEditedRef = useRef(new Set());

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
        const res = await api.getDesigns({ limit: 5000 });
        if (res && res.data) {
          setDesignsList(res.data);
        }
      } catch (err) {
        console.error('Failed to load designs list for autofill:', err);
      }
    };
    fetchAllDesigns();

    if (!card || !card._id || !card.jobNo) {
      const fetchNextNo = async () => {
        try {
          const res = await api.getNextJobCardNo();
          if (res && res.nextJobNo) {
            setForm(f => ({ ...f, jobNo: f.jobNo || String(res.nextJobNo) }));
          }
        } catch (err) {
          console.error('Failed to fetch next job number:', err);
        }
      };
      fetchNextNo();
    }
  }, [card]);

  // Sync selectedDesign if editing an existing card (for reference / machine profiles / preview only, DO NOT overwrite user fields)
  useEffect(() => {
    if (card && (card.designName || card.designNo) && designsList.length > 0) {
      const raw = (card.designName || card.designNo || '').trim().toUpperCase();
      const clean = raw.replace(/^ED-/i, '').trim();
      const matched = designsList.find(d => {
        const dName = (d.designName || '').trim().toUpperCase();
        const dNo = (d.designNo || '').trim().toUpperCase();
        return dName === raw || dNo === raw || dName.replace(/^ED-/i, '').trim() === clean || dNo.replace(/^ED-/i, '').trim() === clean;
      });
      if (matched) {
        setSelectedDesign(matched);
      }
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
    userEditedRef.current.add('designName');
    userEditedRef.current.add('designNo');
    setForm(f => ({ ...f, designName: value, designNo: value }));
    setShowSuggestions(true);
  };

  const selectDesign = (d, imageMode = 'both') => {
    setSelectedDesign(d);
    userEditedRef.current.clear();

    const rawInput = (form.designName || form.designNo || '').trim();
    const existingNames = extractDesignNames(rawInput);
    const dName = d.designName || d.designNo;

    let newDesignName = dName;
    let img1 = '';
    let img2 = '';

    if (imageMode === 'img1') {
      img1 = d.imageUrl || d.imageUrl2 || '';
      img2 = '';
    } else if (imageMode === 'img2') {
      img1 = d.imageUrl2 || d.imageUrl || '';
      img2 = '';
    } else {
      const hasMultiDelimiter = /[,&/+]|\band\b/i.test(rawInput);

      if (hasMultiDelimiter && existingNames.length > 0) {
        const nonDupExisting = existingNames.filter(n => !areDesignsEquivalent(n, dName));
        if (nonDupExisting.length > 0) {
          newDesignName = cleanDesignNameString(`${nonDupExisting.join(', ')}, ${dName}`);

          const d1 = designsList.find(item =>
            (item.designName && areDesignsEquivalent(item.designName, nonDupExisting[0])) ||
            (item.designNo && areDesignsEquivalent(item.designNo, nonDupExisting[0]))
          );

          img1 = (d1 && (d1.imageUrl || d1.imageUrl2)) || form.imageUrl1 || '';
          img2 = d.imageUrl || d.imageUrl2 || '';
        } else {
          newDesignName = dName;
          img1 = d.imageUrl || d.imageUrl2 || '';
          img2 = d.imageUrl2 && d.imageUrl2 !== img1 ? d.imageUrl2 : '';
        }
      } else if (d.imageUrl && d.imageUrl2) {
        img1 = d.imageUrl;
        img2 = d.imageUrl2;
      } else {
        img1 = d.imageUrl || d.imageUrl2 || '';
        img2 = d.imageUrl2 && d.imageUrl2 !== img1 ? d.imageUrl2 : '';
      }
    }

    // Auto-calculate standard values if pcs is already entered
    const pcsVal = parseFloat(form.pcs) || 0;
    const calcScaledPart = (stdVal, pcs) => {
      if (!stdVal) return '';
      const num = parseFloat(stdVal);
      if (isNaN(num) || num <= 0) return '';
      // If the standard was entered as 1 (user intended 1 pc per garment rather than 1/100th), scale as 1 per garment
      const perPc = num === 1 ? 1 : (num / 100);
      const total = perPc * pcs;
      return total % 1 === 0 ? total.toString() : parseFloat(total.toFixed(2)).toString();
    };

    const topVal = calcScaledPart(d.top100, pcsVal);
    const sleeveVal = calcScaledPart(d.sleeve100, pcsVal);
    const bottomVal = calcScaledPart(d.bottom100, pcsVal);
    const dupattaVal = calcScaledPart(d.dupatta100, pcsVal);
    const cutVal = d.cut100 ? d.cut100.toString() : ''; // Cut does not multiply by pcs
    const consumptionVal = d.totalMtr100 ? ((d.totalMtr100 / 100).toFixed(2)) : '';
    const totalMtrVal = d.totalMtr100 ? (((d.totalMtr100 / 100) * pcsVal).toFixed(2)) : '';
    const setCopyVal = d.setCopy100 ? (Math.round((d.setCopy100 / 100) * pcsVal)) : '';

    setForm(f => ({
      ...f,
      designName: newDesignName,
      designNo: newDesignName,
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
      imageUrl1: img1,
      imageUrl2: img2,

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

  const filteredDesigns = useMemo(() => {
    const val = (form.designName || form.designNo || '').trim();
    if (!val) return designsList;

    const names = val.split(/[,&/+]|\band\b/i).map(s => s.trim());
    const lastTerm = (names[names.length - 1] || val).trim();

    if (!lastTerm) return designsList;

    return designsList.filter(d =>
      matchSearchQuery(d, lastTerm, ['designName', 'designNo', 'category', 'fabricName', 'designerName'])
    );
  }, [form.designName, form.designNo, designsList]);

  // Auto-recalculate EXP.TIME whenever relevant fields change
  useEffect(() => {
    const et = calcExpTime(form.panna, form.pass, form.totalMtr, form.machineName);
    if (et !== form.expTime) setForm(f => ({ ...f, expTime: et }));
  }, [form.panna, form.pass, form.totalMtr, form.machineName]);

  const handleMachineSelect = (m) => {
    setForm(f => {
      const updates = { ...f, machineName: m };
      // Only auto-resolve profile if user has NOT manually customized/edited profile
      if (!userEditedRef.current.has('profile') && selectedDesign?.machineProfiles && selectedDesign.machineProfiles[m]) {
        updates.profile = selectedDesign.machineProfiles[m];
      }
      return updates;
    });
  };

  const onChange = e => {
    const { name, value } = e.target;
    userEditedRef.current.add(name);

    if (name === 'pcs') {
      const pcsVal = parseFloat(value) || 0;
      setForm(f => {
        const isExisting = Boolean(card && card._id);
        const consVal = parseFloat(f.consumption) || (selectedDesign?.totalMtr100 ? selectedDesign.totalMtr100 / 100 : 0);
        // Only auto-recalculate totalMtr if user did NOT explicitly edit totalMtr
        const shouldUpdateTotalMtr = !userEditedRef.current.has('totalMtr');
        const totalMtrVal = (shouldUpdateTotalMtr && consVal > 0 && pcsVal > 0)
          ? (pcsVal * consVal).toFixed(2)
          : f.totalMtr;

        if (isExisting) {
          // Editing existing job card: NEVER resurrect removed fields or override user-edited values
          return {
            ...f,
            pcs: value,
            totalMtr: totalMtrVal || f.totalMtr
          };
        }

        const d = selectedDesign;
        if (!d) {
          return {
            ...f,
            pcs: value,
            totalMtr: totalMtrVal || f.totalMtr
          };
        }

        const updates = {
          ...f,
          pcs: value,
          totalMtr: totalMtrVal || f.totalMtr
        };

        const calcScaledPart = (stdVal, pcs) => {
          if (!stdVal) return '';
          const num = parseFloat(stdVal);
          if (isNaN(num) || num <= 0) return '';
          const perPc = num === 1 ? 1 : (num / 100);
          const total = perPc * pcs;
          return total % 1 === 0 ? total.toString() : parseFloat(total.toFixed(2)).toString();
        };

        // ONLY scale measurement fields if user has NOT manually edited or cleared them
        if (!userEditedRef.current.has('top') && f.top !== '' && f.top !== undefined && d.top100) updates.top = calcScaledPart(d.top100, pcsVal);
        if (!userEditedRef.current.has('sleeve') && f.sleeve !== '' && f.sleeve !== undefined && d.sleeve100) updates.sleeve = calcScaledPart(d.sleeve100, pcsVal);
        if (!userEditedRef.current.has('bottom') && f.bottom !== '' && f.bottom !== undefined && d.bottom100) updates.bottom = calcScaledPart(d.bottom100, pcsVal);
        if (!userEditedRef.current.has('dupatta') && f.dupatta !== '' && f.dupatta !== undefined && d.dupatta100) updates.dupatta = calcScaledPart(d.dupatta100, pcsVal);
        if (!userEditedRef.current.has('setCopy') && f.setCopy !== '' && f.setCopy !== undefined && d.setCopy100) updates.setCopy = Math.round((d.setCopy100 / 100) * pcsVal).toString();
        if (!userEditedRef.current.has('cut') && f.cut !== '' && f.cut !== undefined && d.cut100) updates.cut = d.cut100.toString();

        return updates;
      });
    } else if (name === 'consumption') {
      const pcsVal = parseFloat(form.pcs) || 0;
      const consVal = parseFloat(value) || 0;
      const shouldUpdateTotalMtr = !userEditedRef.current.has('totalMtr');
      const totalMtrVal = (shouldUpdateTotalMtr && pcsVal > 0 && consVal > 0)
        ? (pcsVal * consVal).toFixed(2)
        : form.totalMtr;
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
    const cleanFabric = (form.fabric || '').trim();
    const cleanDesign = cleanDesignNameString(form.designName || form.designNo);
    const activeUser = api.getCurrentUser() || {};
    const uName = activeUser.name || activeUser.username || 'HASI';
    const uId = activeUser._id || activeUser.id || '';
    const payload = {
      ...form,
      designName: cleanDesign || form.designName,
      designNo: cleanDesign || form.designNo,
      fabric: cleanFabric || form.fabric,
      department: department || (card?.department) || 'digital_print',
      category: form.category || (department === 'stitching' ? 'Stitching' : ''),
      isClientForm: true,
      userId: uId,
      createdById: uId,
      updatedById: uId,
      userName: uName,
      createdBy: form.createdBy || uName,
      updatedBy: uName
    };

    delete payload._id;
    delete payload.id;
    delete payload.created_date_time;
    delete payload.modified_date_time;
    delete payload.__v;
    if (!payload.orderChatRoomId) delete payload.orderChatRoomId;

    try {
      if (card?._id || card?.id) {
        const targetId = card._id || card.id;
        await api.updateJobCard(targetId, payload);
        triggerPushNotification('📝 Job Card Updated', `Job Card #${form.jobNo} saved successfully.`, 'info');
      } else {
        await api.createJobCard(payload);
        triggerPushNotification('✨ Job Card Created', `Job Card #${form.jobNo} created successfully!`, 'success');
        dispatchScreenGroupEvent('jobcards', 'New Job Card Created 🚀', `Job Card #${form.jobNo} for ${form.party || 'Customer'} was created and dispatched to Job Cards Group.`, 'jobcards_list');
      }
      onSave();
    } catch (err) {
      console.error('Save Job Card error:', err);
      const msg = err.message || 'Failed to save job card. Please check server logs or network.';
      setError(msg);
      triggerEliteAlert('Failed to Save Job Card', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', paddingTop:'1rem' }}>
        {/* Header */}
        <form onSubmit={handleSubmit} style={{ background:'var(--bg-modal,#111827)', border:'1px solid var(--border-light)',
          borderRadius:'var(--radius-lg)', width:'100%', maxWidth:900,
          boxShadow:'var(--shadow-lg)', overflow:'hidden', maxHeight:'96vh', display:'flex', flexDirection:'column' }}>

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
            <button type="button" onClick={onClose} className="btn-icon"><X size={16}/></button>
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY:'auto', padding:'1.25rem 1.5rem', flex:1 }}>
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
                  <button type="button" key={m} onClick={() => handleMachineSelect(m)}
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
                Design No. / Design Name *
              </label>
              <input
                type="text"
                name="designName"
                value={form.designName}
                onChange={handleDesignNameChange}
                onBlur={() => {
                  const cleaned = cleanDesignNameString(form.designName || form.designNo);
                  if (cleaned !== form.designName) {
                    setForm(f => ({ ...f, designName: cleaned, designNo: cleaned }));
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type or select Design No. (e.g. ED1, ED2)..."
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
                  maxHeight:'200px',
                  overflowY:'auto',
                  zIndex:999,
                  marginTop:'4px'
                }}>
                  {filteredDesigns.map(d => {
                    const hasTwoImages = !!(d.imageUrl && d.imageUrl2);
                    return (
                      <div
                        key={d._id}
                        onClick={() => selectDesign(d, 'both')}
                        style={{
                          padding:'0.5rem 0.75rem',
                          fontSize:'0.8rem',
                          cursor:'pointer',
                          borderBottom:'1px solid var(--border-light)',
                          color:'var(--text-primary)',
                          display:'flex',
                          justifyContent:'space-between',
                          alignItems:'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {d.imageUrl && (
                            <img
                              src={convertDriveUrl(d.imageUrl)}
                              alt=""
                              referrerPolicy="no-referrer"
                              style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }}
                              onError={(e) => {
                                const currentSrc = e.target.src || '';
                                if (!e.target.dataset.retried) {
                                  e.target.dataset.retried = '1';
                                  if (currentSrc.endsWith('.jpeg')) {
                                    e.target.src = currentSrc.slice(0, -5) + '.jpg';
                                    return;
                                  } else if (currentSrc.endsWith('.jpg')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.jpeg';
                                    return;
                                  } else if (currentSrc.endsWith('.png')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.jpg';
                                    return;
                                  } else if (!currentSrc.includes('.')) {
                                    e.target.src = currentSrc + '.jpg';
                                    return;
                                  }
                                } else if (e.target.dataset.retried === '1') {
                                  e.target.dataset.retried = '2';
                                  if (currentSrc.endsWith('.jpg')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.png';
                                    return;
                                  } else if (currentSrc.endsWith('.jpeg')) {
                                    e.target.src = currentSrc.slice(0, -5) + '.png';
                                    return;
                                  }
                                }
                                const fidMatch = d.imageUrl?.match(/\/d\/([-\w]{20,})/) || d.imageUrl?.match(/[?&]id=([-\w]{20,})/) || d.imageUrl?.match(/([-\w]{25,})/);
                                if (fidMatch && fidMatch[1]) {
                                  e.target.src = `https://lh3.googleusercontent.com/d/${fidMatch[1]}=s200`;
                                } else {
                                  e.target.style.display = 'none';
                                }
                              }}
                            />
                          )}
                          {d.imageUrl2 && (
                            <img
                              src={convertDriveUrl(d.imageUrl2)}
                              alt=""
                              referrerPolicy="no-referrer"
                              style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }}
                              onError={(e) => {
                                const currentSrc = e.target.src || '';
                                if (!e.target.dataset.retried) {
                                  e.target.dataset.retried = '1';
                                  if (currentSrc.endsWith('.jpeg')) {
                                    e.target.src = currentSrc.slice(0, -5) + '.jpg';
                                    return;
                                  } else if (currentSrc.endsWith('.jpg')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.jpeg';
                                    return;
                                  } else if (currentSrc.endsWith('.png')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.jpg';
                                    return;
                                  } else if (!currentSrc.includes('.')) {
                                    e.target.src = currentSrc + '.jpg';
                                    return;
                                  }
                                } else if (e.target.dataset.retried === '1') {
                                  e.target.dataset.retried = '2';
                                  if (currentSrc.endsWith('.jpg')) {
                                    e.target.src = currentSrc.slice(0, -4) + '.png';
                                    return;
                                  } else if (currentSrc.endsWith('.jpeg')) {
                                    e.target.src = currentSrc.slice(0, -5) + '.png';
                                    return;
                                  }
                                }
                                const fidMatch = d.imageUrl2?.match(/\/d\/([-\w]{20,})/) || d.imageUrl2?.match(/[?&]id=([-\w]{20,})/) || d.imageUrl2?.match(/([-\w]{25,})/);
                                if (fidMatch && fidMatch[1]) {
                                  e.target.src = `https://lh3.googleusercontent.com/d/${fidMatch[1]}=s200`;
                                } else {
                                  e.target.style.display = 'none';
                                }
                              }}
                            />
                          )}
                          <div>
                            <span style={{ fontWeight:700, color:'var(--primary)' }}>{d.designName || d.designNo}</span>
                            {d.designNo && d.designNo !== d.designName && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px' }}>({d.designNo})</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                            {d.fabricName ? `${d.fabricName} • ` : ''}{d.category || ''}
                          </span>

                          {hasTwoImages && (
                            <div style={{ display: 'flex', gap: '3px' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => selectDesign(d, 'both')}
                                title="Use Both Images"
                                style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 3, cursor: 'pointer' }}
                              >
                                Both
                              </button>
                              <button
                                type="button"
                                onClick={() => selectDesign(d, 'img1')}
                                title="Use Image 1 Only"
                                style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 3, cursor: 'pointer' }}
                              >
                                Img 1
                              </button>
                              <button
                                type="button"
                                onClick={() => selectDesign(d, 'img2')}
                                title="Use Image 2 Only"
                                style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 3, cursor: 'pointer' }}
                              >
                                Img 2
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Field label="Date" name="date" type="date" form={form} onChange={onChange} half/>
            <Field label="Status" name="status" form={form} onChange={onChange}
              options={['Pending','In Progress','Done']} half/>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flex: '1 1 calc(33% - 0.4rem)', minWidth:130 }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                Created By (Staff Member)
              </label>
              <select 
                name="createdBy" 
                value={form.createdBy || form.createdByName || ''} 
                onChange={(e) => setForm(f => ({ ...f, createdBy: e.target.value, createdByName: e.target.value }))}
                style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontWeight: 600 }}
              >
                <option value="Parth Asodariya">Parth Asodariya</option>
                <option value="Harshil">Harshil</option>
                <option value="HASI">HASI</option>
                <option value="Rushabh">Rushabh</option>
                <option value="JAY">JAY</option>
                <option value="Ram">Ram</option>
                <option value="Ajay Bind">Ajay Bind</option>
                <option value="Dev Patel">Dev Patel</option>
                <option value="Dhruv Patel">Dhruv Patel</option>
                <option value="Durgesh Yadav">Durgesh Yadav</option>
                <option value="Kaushik sir">Kaushik sir</option>
                <option value="EliteAC">EliteAC</option>
                <option value="Elite Edition">Elite Edition</option>
              </select>
            </div>
          </div>

          {/* Section: Party Details */}
          <div style={sectionLabel}>🏢 Party & Order Details</div>
          <div style={rowStyle}>
            <Field label="Party Name" name="party" form={form} onChange={onChange} options={['', ...(printConfig.parties || [])]} half/>
            <Field label="Bill To" name="billTo" form={form} onChange={onChange} options={['', ...(printConfig.billToOptions || [])]} half/>
            <Field label="Ship To" name="shipTo" form={form} onChange={onChange} options={['', ...(printConfig.shipToOptions || [])]} half/>
            <Field label="Client PO / Ref No." name="clientPoNo" form={form} onChange={onChange} placeholder="e.g. PO-8921" half/>
            <Field label="Lot No." name="lotNo" form={form} onChange={onChange} placeholder="e.g. LOT-45A" half/>
            <Field label="Target Delivery Date" name="targetDeliveryDate" type="date" form={form} onChange={onChange} half/>
          </div>

          {/* Section: Fabric & Garment */}
          <div style={sectionLabel}>👗 Garment & Fabric Details</div>
          <div style={rowStyle}>
            <Field label="Category" name="category" form={form} onChange={onChange} options={['', ...printConfig.categories]} half/>
            <Field label="Fabric" name="fabric" form={form} onChange={onChange} options={['', ...(printConfig.fabrics || [])]} half/>
            <Field label="Fabric Source / Mill" name="fabricSource" form={form} onChange={onChange} placeholder="e.g. Surat Mill / In-House" half/>
            <Field label="Raw Panna (Greige)" name="rawPanna" form={form} onChange={onChange} placeholder="e.g. 48 Inch" half/>
            <Field label="Exp. Shrinkage %" name="shrinkagePct" type="number" form={form} onChange={onChange} placeholder="e.g. 2.5" half/>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={sectionLabel}>🖼 Design Images</div>
            {(form.imageUrl1 || form.imageUrl2 || (selectedDesign && (selectedDesign.imageUrl || selectedDesign.imageUrl2))) && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>IMAGE MODE:</span>
                
                {/* Both Images Button */}
                <button
                  type="button"
                  onClick={() => {
                    const img1 = (selectedDesign && selectedDesign.imageUrl) || form.imageUrl1 || '';
                    const img2 = (selectedDesign && selectedDesign.imageUrl2) || form.imageUrl2 || '';
                    setForm(f => ({ ...f, imageUrl1: img1, imageUrl2: img2 }));
                  }}
                  style={{
                    padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700,
                    border: '1px solid',
                    borderColor: (!!form.imageUrl1 && !!form.imageUrl2) ? '#38bdf8' : 'var(--border-light)',
                    background: (!!form.imageUrl1 && !!form.imageUrl2) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: (!!form.imageUrl1 && !!form.imageUrl2) ? '#38bdf8' : 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  📸 Both Images
                </button>

                {/* Image 1 Only Button */}
                <button
                  type="button"
                  onClick={() => {
                    const img1 = (selectedDesign && selectedDesign.imageUrl) || form.imageUrl1 || form.imageUrl2 || '';
                    setForm(f => ({ ...f, imageUrl1: img1, imageUrl2: '' }));
                  }}
                  style={{
                    padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700,
                    border: '1px solid',
                    borderColor: (!!form.imageUrl1 && !form.imageUrl2 && (!selectedDesign || form.imageUrl1 !== selectedDesign.imageUrl2)) ? '#38bdf8' : 'var(--border-light)',
                    background: (!!form.imageUrl1 && !form.imageUrl2 && (!selectedDesign || form.imageUrl1 !== selectedDesign.imageUrl2)) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: (!!form.imageUrl1 && !form.imageUrl2 && (!selectedDesign || form.imageUrl1 !== selectedDesign.imageUrl2)) ? '#38bdf8' : 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  🖼️ Img 1 Only
                </button>

                {/* Image 2 Only Button */}
                <button
                  type="button"
                  onClick={() => {
                    const img2 = (selectedDesign && selectedDesign.imageUrl2) || form.imageUrl2 || form.imageUrl1 || '';
                    setForm(f => ({ ...f, imageUrl1: img2, imageUrl2: '' }));
                  }}
                  style={{
                    padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700,
                    border: '1px solid',
                    borderColor: (!!form.imageUrl1 && !form.imageUrl2 && selectedDesign && form.imageUrl1 === selectedDesign.imageUrl2) ? '#38bdf8' : 'var(--border-light)',
                    background: (!!form.imageUrl1 && !form.imageUrl2 && selectedDesign && form.imageUrl1 === selectedDesign.imageUrl2) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: (!!form.imageUrl1 && !form.imageUrl2 && selectedDesign && form.imageUrl1 === selectedDesign.imageUrl2) ? '#38bdf8' : 'var(--text-muted)', cursor: 'pointer'
                  }}
                >
                  🖼️ Img 2 Only
                </button>

                {/* Swap Button */}
                {(form.imageUrl1 || form.imageUrl2) && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, imageUrl1: f.imageUrl2, imageUrl2: f.imageUrl1 }));
                    }}
                    style={{
                      padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700,
                      border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.04)',
                      color: 'var(--text-muted)', cursor: 'pointer'
                    }}
                  >
                    🔄 Swap
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.6rem', lineHeight:1.5 }}>
            🖼️ Upload an image file directly or paste any image URL below.
          </div>
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
            <ImageField label="Image 1 — Design / Pattern" name="imageUrl1" form={form} onChange={onChange} index={1}/>
            <ImageField label="Image 2 — Fabric / Full View" name="imageUrl2" form={form} onChange={onChange} index={2}/>
          </div>
          </div>

        {/* Footer */}
        <div className="modal-footer-sticky" style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-light)',
          display:'flex', gap:'0.75rem', justifyContent:'flex-end', flexShrink:0 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding:'0.55rem 1.2rem' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding:'0.55rem 1.4rem' }} disabled={saving}>
            <Save size={14}/>
            {saving ? 'Saving...' : card ? 'Update Job Card' : 'Create Job Card'}
          </button>
        </div>
      </form>
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
export default function JobCardPanel({ activeSubTab = 'jobcards', department, currentUser }) {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalMtr, setTotalMtr] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedParty, setSelectedParty] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState([]);
  const [selectedDesigner, setSelectedDesigner] = useState([]);
  const [sortBy, setSortBy] = useState('jobNo');
  const [sortOrder, setSortOrder] = useState('desc');
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Dynamically compute options from cards for Unified Filter Popover
  const availableParties = useMemo(() => {
    const set = new Set();
    cards.forEach(c => { if (c.party && String(c.party).trim()) set.add(String(c.party).trim()); });
    return Array.from(set).sort();
  }, [cards]);

  const availableMachines = useMemo(() => {
    const set = new Set();
    cards.forEach(c => { if (c.machineName && String(c.machineName).trim()) set.add(String(c.machineName).trim()); });
    return Array.from(set).sort();
  }, [cards]);

  const availableFabrics = useMemo(() => {
    const set = new Set();
    cards.forEach(c => { if (c.fabric && String(c.fabric).trim()) set.add(String(c.fabric).trim()); });
    return Array.from(set).sort();
  }, [cards]);

  const availableDesigners = useMemo(() => {
    const set = new Set();
    cards.forEach(c => { if (c.designer && String(c.designer).trim()) set.add(String(c.designer).trim()); });
    return Array.from(set).sort();
  }, [cards]);

  const jobCardFilters = useMemo(() => [
    {
      id: 'status',
      label: 'Stage / Status',
      options: ['Pending', 'Printing', 'Fusing', 'Delivery']
    },
    {
      id: 'party',
      label: 'Party (Client)',
      icon: User,
      options: availableParties
    },
    {
      id: 'machine',
      label: 'Machine',
      icon: Building2,
      options: availableMachines
    },
    {
      id: 'fabric',
      label: 'Fabric',
      icon: Scissors,
      options: availableFabrics
    },
    {
      id: 'designer',
      label: 'Designer',
      icon: User,
      options: availableDesigners
    }
  ], [availableParties, availableMachines, availableFabrics, availableDesigners]);

  const jobCardFilterValues = useMemo(() => ({
    status: statusFilter && statusFilter !== 'All' ? [statusFilter] : [],
    party: selectedParty,
    machine: selectedMachine,
    fabric: selectedFabric,
    designer: selectedDesigner
  }), [statusFilter, selectedParty, selectedMachine, selectedFabric, selectedDesigner]);

  const handleJobCardFilterChange = (newVals) => {
    const nextStatuses = newVals.status || [];
    setStatusFilter(nextStatuses.length === 1 ? nextStatuses[0] : (nextStatuses.length > 1 ? nextStatuses[0] : 'All'));
    setSelectedParty(newVals.party || []);
    setSelectedMachine(newVals.machine || []);
    setSelectedFabric(newVals.fabric || []);
    setSelectedDesigner(newVals.designer || []);
    setPage(1);
  };

  const handleClearAllJobCardFilters = () => {
    setStatusFilter('All');
    setSelectedParty([]);
    setSelectedMachine([]);
    setSelectedFabric([]);
    setSelectedDesigner([]);
    setPage(1);
  };

  // Client-side multi-filter refinement for cards display
  const displayedCards = useMemo(() => {
    let result = cards;
    if (selectedParty.length > 0) {
      result = result.filter(c => c.party && selectedParty.some(p => p.toLowerCase() === c.party.toLowerCase()));
    }
    if (selectedMachine.length > 0) {
      result = result.filter(c => c.machineName && selectedMachine.some(m => m.toLowerCase() === c.machineName.toLowerCase()));
    }
    if (selectedFabric.length > 0) {
      result = result.filter(c => c.fabric && selectedFabric.some(f => f.toLowerCase() === c.fabric.toLowerCase()));
    }
    if (selectedDesigner.length > 0) {
      result = result.filter(c => c.designer && selectedDesigner.some(d => d.toLowerCase() === c.designer.toLowerCase()));
    }
    return result;
  }, [cards, selectedParty, selectedMachine, selectedFabric, selectedDesigner]);
  const [formCard, setFormCard] = useState(null);   // null=closed, {}=new, {...}=edit
  const [showForm, setShowForm] = useState(false);
  const [historyModalCard, setHistoryModalCard] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [billingChallanData, setBillingChallanData] = useState(null);
  const [overrideSubTab, setOverrideSubTab] = useState(null);

  const effectiveSubTab = overrideSubTab || activeSubTab;

  useEffect(() => {
    setOverrideSubTab(null);
  }, [activeSubTab]);

  // Sharing to Chat states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [shareCompanyFilter, setShareCompanyFilter] = useState('');
  const [shareSearch, setShareSearch] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [loadingShareRooms, setLoadingShareRooms] = useState(false);
  const [sharingJobCard, setSharingJobCard] = useState(false);

  // Multi-select for Job Cards Bulk Download / Print
  const [selectedJobCardIds, setSelectedJobCardIds] = useState([]);

  const handleToggleSelectAllJobCards = (visibleCards) => {
    const visibleIds = visibleCards.map(c => c._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedJobCardIds.includes(id));
    if (allSelected) {
      setSelectedJobCardIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedJobCardIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectJobCard = (id) => {
    setSelectedJobCardIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPrintSelectedJobCards = async () => {
    if (selectedJobCardIds.length === 0) return;
    const selectedCards = cards.filter(c => selectedJobCardIds.includes(c._id));
    if (selectedCards.length > 0) {
      triggerJobCardPrint(selectedCards);
      triggerPushNotification('🖨️ Multi-Select Job Cards Print', `Opened ${selectedCards.length} Job Cards in physical A5 print view.`, 'success');
    } else {
      try {
        await api.downloadBulkJobCardPdf(
          selectedJobCardIds,
          `Combined_Job_Cards_${selectedJobCardIds.length}_Cards.pdf`
        );
        triggerPushNotification('📥 Combined Job Cards PDF Downloaded', `${selectedJobCardIds.length} Job Cards merged into 1 single multi-page PDF document.`, 'success');
      } catch (e) {
        triggerEliteAlert('PDF Error', 'Failed to generate combined Job Cards PDF: ' + e.message, 'error');
      }
    }
  };

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

  const detectCompanyForCard = (card) => {
    if (!card) return 'Elite Digital Print';
    const cardDept = (card.department || '').toLowerCase();
    const cardParty = (card.party || '').toLowerCase();
    if (cardDept === 'stitching' || cardParty.includes('stitching')) return 'Elite Stitching';
    if (cardParty.includes('online') || cardParty.includes('eon')) return 'Elite Online';
    if (cardParty.includes('fabtex')) return 'Elite Fabtex';
    if (cardParty.includes('edition')) return 'Elite Edition';
    return 'Elite Digital Print';
  };

  const loadShareRooms = async (targetCard, forceSync = false) => {
    setLoadingShareRooms(true);
    try {
      if (forceSync) {
        await api.syncCommunicationGroups().catch(() => {});
      }
      let res = await api.getCommunicationGroups();
      let groupsList = Array.isArray(res) ? res : (res?.data || []);

      if (groupsList.length === 0) {
        await api.syncCommunicationGroups().catch(() => {});
        res = await api.getCommunicationGroups();
        groupsList = Array.isArray(res) ? res : (res?.data || []);
      }

      if (groupsList.length === 0) {
        const legacyRes = await api.getRooms().catch(() => null);
        if (legacyRes?.data) groupsList = legacyRes.data;
      }

      setChatRooms(groupsList);

      const card = targetCard || shareCard;
      if (card && groupsList.length > 0) {
        const detectedComp = detectCompanyForCard(card).toLowerCase();
        const autoGroup = groupsList.find((g) => {
          if (g.type === 'direct') return false;
          const gName = (g.name || '').toLowerCase();
          const gComp = (g.companyEntity || '').toLowerCase();
          if (detectedComp.includes('print')) return gComp.includes('print') || gName.includes('job card') || gName.includes('print');
          if (detectedComp.includes('online')) return gComp.includes('online') || gName.includes('sales');
          if (detectedComp.includes('stitching')) return gComp.includes('stitching') || gName.includes('stitching');
          if (detectedComp.includes('fabtex')) return gComp.includes('fabtex') || gName.includes('fabtex');
          if (detectedComp.includes('edition')) return gComp.includes('edition') || gName.includes('operations');
          return gComp.includes(detectedComp) || gName.includes(detectedComp);
        });

        if (autoGroup) {
          setSelectedRoomId(autoGroup._id);
        } else {
          setSelectedRoomId(groupsList[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load chat rooms for sharing', err);
    } finally {
      setLoadingShareRooms(false);
    }
  };

  const handleSelectShareCompany = (comp) => {
    setShareCompanyFilter(comp);
    if (!comp) return;
    const cLow = comp.toLowerCase();
    const match = chatRooms.find((r) => {
      if (r.type === 'direct') return false;
      const rName = (r.name || '').toLowerCase();
      const rComp = (r.companyEntity || '').toLowerCase();
      if (cLow.includes('print')) return rComp.includes('print') || rName.includes('job card') || rName.includes('print');
      if (cLow.includes('online')) return rComp.includes('online') || rName.includes('online') || rName.includes('sales');
      if (cLow.includes('stitching')) return rComp.includes('stitching') || rName.includes('stitching');
      if (cLow.includes('fabtex')) return rComp.includes('fabtex') || rName.includes('fabtex');
      if (cLow.includes('edition')) return rComp.includes('edition') || rName.includes('operations');
      return rComp.includes(cLow) || rName.includes(cLow);
    });
    if (match) setSelectedRoomId(match._id);
  };

  const handleOpenShareModal = (card) => {
    setShareCard(card);
    const initialComp = detectCompanyForCard(card);
    setShareCompanyFilter(initialComp);
    setShareSearch('');
    setShareNote('');
    setShowShareModal(true);
    loadShareRooms(card);
  };

  const handleShareJobCard = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedRoomId || !shareCard) return;

    setSharingJobCard(true);
    try {
      const currentUser = api.getCurrentUser();
      const myId = currentUser ? (currentUser._id || currentUser.id) : '';

      const refVal = `JC-${shareCard.jobNo}`;
      const notePrefix = shareNote.trim() ? `${shareNote.trim()}\n\n` : '';
      const cardTitle = `${notePrefix}📋 Job Card #${shareCard.jobNo} — ${shareCard.party || 'Client'}`;
      const actMeta = {
        action: 'SHARE_RECORD',
        module: 'Job Card',
        recordRef: refVal,
        recordId: shareCard._id,
        permissionScope: 'jobcards',
        jobNo: shareCard.jobNo,
        party: shareCard.party,
        totalMtr: shareCard.totalMtr,
        status: shareCard.status || shareCard.currentStage
      };

      const messagePayload = {
        roomId: selectedRoomId,
        senderId: myId,
        content: cardTitle,
        type: 'record-card',
        activityMeta: actMeta,
        recordMentions: [{ recordType: 'jobcard', recordRef: refVal }]
      };

      await api.sendCommunicationMessage(selectedRoomId, messagePayload);

      const targetRoom = chatRooms.find((r) => String(r._id) === String(selectedRoomId));
      triggerEliteAlert('Job Card Shared 🚀', `Job Card #${shareCard.jobNo} shared directly to "${targetRoom?.name || 'chat'}"!`, 'success');
      setShowShareModal(false);
      setShareCard(null);
      setSelectedRoomId('');
      setShareSearch('');
      setShareNote('');
      setShareCompanyFilter('');
    } catch (err) {
      console.error('Failed to share job card', err);
      triggerEliteAlert('Sharing Failed', 'Failed to share job card: ' + err.message, 'error');
    } finally {
      setSharingJobCard(false);
    }
  };

  const fetchCards = useCallback(async (isSilent = false, targetPage = 1, targetPageSize = pageSizeRef.current) => {
    if (activeSubTab !== 'list') return;
    // Cancel any in-flight request to prevent race conditions
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isSilent) setLoading(true);
    setError('');
    try {
      const isAll = targetPageSize === 'all' || targetPageSize >= 1000;
      const numLimit = isAll ? 2000 : Number(targetPageSize || 25);
      const effectiveLimit = isAll ? 2000 : (isSilent && targetPage > 1 ? targetPage * numLimit : numLimit);
      const effectivePage = isAll || (isSilent && targetPage > 1) ? 1 : targetPage;
      const res = await api.getJobCards({
        search: debouncedSearch,
        status: statusFilter === 'All' ? '' : statusFilter,
        department,
        page: effectivePage,
        limit: effectiveLimit,
        sortBy,
        sortOrder,
        dateStart,
        dateEnd
      });
      if (!controller.signal.aborted) {
        if (!isSilent) {
          setCards(res.data || []);
        } else if (res.data) {
          setCards(prev => {
            if (prev.length !== res.data.length) return res.data;
            const prevIds = prev.map(c => c._id || c.id).join(',');
            const nextIds = res.data.map(c => c._id || c.id).join(',');
            return prevIds === nextIds ? prev : res.data;
          });
        }
        setTotal(res.total || 0);
        setTotalMtr(res.totalMtr || 0);
        if (res.statusCounts) setStatusCounts(res.statusCounts);
        setPages(isAll ? 1 : (res.pages || 1));
        if (!isSilent) {
          setPage(isAll ? 1 : targetPage);
          pageRef.current = isAll ? 1 : targetPage;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted && !isSilent) {
        setError(err.message || 'Failed to load job cards.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, activeSubTab, sortBy, sortOrder, dateStart, dateEnd, department]);

  const pageRef = useRef(page);
  pageRef.current = page;
  const loadingMoreRef = useRef(false);

  // Infinite scroll loader: fetches next page and appends with deduplication
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || pageRef.current >= pages || pageSizeRef.current === 'all') return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const currentLimit = Number(pageSizeRef.current || 25);
      const res = await api.getJobCards({
        search: debouncedSearch,
        status: statusFilter === 'All' ? '' : statusFilter,
        department,
        page: nextPage,
        limit: currentLimit,
        sortBy,
        sortOrder,
        dateStart,
        dateEnd
      });
      if (res && res.data && res.data.length > 0) {
        setCards(prev => {
          const existingIds = new Set(prev.map(c => String(c._id || c.id)));
          const newItems = res.data.filter(c => !existingIds.has(String(c._id || c.id)));
          return newItems.length > 0 ? [...prev, ...newItems] : prev;
        });
        setPage(nextPage);
        pageRef.current = nextPage;
        if (res.pages) setPages(res.pages);
        if (res.total !== undefined) setTotal(res.total);
        if (res.totalMtr !== undefined) setTotalMtr(res.totalMtr);
        if (res.statusCounts) setStatusCounts(res.statusCounts);
      }
    } catch (e) {
      console.warn('Failed to load more job cards:', e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [pages, debouncedSearch, statusFilter, department, sortBy, sortOrder, dateStart, dateEnd]);

  useEffect(() => {
    fetchCards(false, 1);
    const interval = setInterval(() => fetchCards(true, pageRef.current), 15000);
    const handleDataRefresh = () => fetchCards(true, pageRef.current);
    window.addEventListener('elite-data-refresh', handleDataRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('elite-data-refresh', handleDataRefresh);
    };
  }, [debouncedSearch, statusFilter, activeSubTab, sortBy, sortOrder, dateStart, dateEnd, department, fetchCards]);

  const handleDelete = async (id, jobNo) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Job Card',
      message: `Are you sure you want to delete Job Card "${jobNo}"? This action cannot be undone.`,
      confirmText: 'Delete Job Card',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.deleteJobCard(id);
      triggerPushNotification('🗑️ Job Card Deleted', `Job Card #${jobNo} removed.`, 'warning');
      triggerGlobalDataRefresh('jobcards');
      fetchCards();
    } catch (err) {
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete.', 'error');
    }
  };

  const handleSendToBilling = async (c) => {
    const user = api.getCurrentUser() || {};
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isMainAdmin === true;

    // ── 1. Check Printing Stage ──
    const pStatus = (c.printStatus || '').toLowerCase();
    const pMtr = parseFloat(c.printMtr || 0);
    const isPrintDone = pStatus.includes('done') || pMtr > 0;

    if (!isPrintDone) {
      if (!isAdmin) {
        triggerEliteAlert(
          'Printing Stage Incomplete',
          `Cannot create Delivery Challan for Job #${c.jobNo}. This Job Card has not completed the Printing stage yet (Status: ${c.printStatus || 'Printing Pending'}). Printing must be logged first.`,
          'warning'
        );
        return;
      }
      const proceed = await triggerEliteConfirm({
        title: 'Admin Override: Printing Incomplete',
        message: `Job Card #${c.jobNo} has NOT passed the Printing Stage yet (Status: ${c.printStatus || 'Printing Pending'}). As an Admin, do you want to override and create a Challan anyway?`,
        confirmText: 'Override & Proceed',
        cancelText: 'Cancel'
      });
      if (!proceed) return;
    }

    // ── 2. Check Fusing Stage ──
    const fStatus = (c.fusingStatus || '').toLowerCase();
    const totalFusedMtr = parseFloat(c.fusingMtr || c.freshMtr || 0);
    const deliveredM = parseFloat(c.deliveredMtr) || 0;
    const isFusingDone = fStatus.includes('done');
    const remainingFusedMtr = Math.max(0, totalFusedMtr - deliveredM);

    if (!isFusingDone && totalFusedMtr <= 0) {
      if (!isAdmin) {
        triggerEliteAlert(
          'Fusing Stage Incomplete',
          `Cannot create Delivery Challan for Job #${c.jobNo}. This Job Card has not completed the Fusing stage yet (0m fused). Fusing must be logged before dispatch.`,
          'warning'
        );
        return;
      }
      const proceed = await triggerEliteConfirm({
        title: 'Admin Override: Fusing Incomplete',
        message: `Job Card #${c.jobNo} has NOT passed Fusing (0m fused). As an Admin, do you want to override and create a Challan anyway?`,
        confirmText: 'Override & Proceed',
        cancelText: 'Cancel'
      });
      if (!proceed) return;
    }

    // ── 3. Quantities with Partial Quantities Support ──
    const totalJobMtr = parseFloat(c.totalMtr) || parseFloat(c.totalQty) || 1;
    let billQty;

    if (totalFusedMtr > 0) {
      // Partial quantities: Use available fused meters that haven't been delivered yet!
      billQty = remainingFusedMtr > 0 ? Math.round(remainingFusedMtr * 100) / 100 : Math.round(totalFusedMtr * 100) / 100;
    } else {
      // Admin override without fusing
      const remainingTotal = totalJobMtr > deliveredM ? (totalJobMtr - deliveredM) : totalJobMtr;
      billQty = Math.round(remainingTotal * 100) / 100;
    }

    if (billQty <= 0 && remainingFusedMtr <= 0 && deliveredM >= totalJobMtr) {
      triggerEliteAlert(
        'Already Fully Dispatched',
        `Job Card #${c.jobNo} has already been fully delivered (${deliveredM}m of ${totalJobMtr}m delivered).`,
        'info'
      );
      return;
    }

    if (totalFusedMtr > 0 && billQty < totalJobMtr) {
      triggerPushNotification(
        '📦 Partial Challan Batch',
        `Preparing Partial Delivery Challan for ${billQty}m of fused fabric (Total Job: ${totalJobMtr}m, Delivered so far: ${deliveredM}m).`,
        'info'
      );
    }

    const rate = parseFloat(c.rate) || 0;

    const challanData = {
      isJobCardChallan: true,
      challanNo: c.ourChallanNo || c.jobNo,
      jobNo: c.jobNo,
      party: c.party,
      customerName: c.party,
      designNo: c.designNo || c.designName,
      fabric: c.fabric,
      lotNo: c.lotNo,
      partyChallan: c.partyChallan,
      vendorChallanNo: c.partyChallan,
      ourChallanNo: c.ourChallanNo || c.jobNo,
      date: c.date,
      totalMtr: billQty,
      items: [
        {
          designNo: c.designNo || c.designName,
          particulars: `Digital Printing Service - ${c.fabric || 'Fabric'} (Design: ${c.designNo || c.designName || ''})`,
          pcs: billQty,
          rate: rate,
          amount: billQty * rate,
          hsnCode: '998821',
          unit: 'Meters',
          jobNo: c.jobNo,
          lotNo: c.lotNo,
          partyChallan: c.partyChallan,
          ourChallanNo: c.ourChallanNo || c.jobNo,
          imageUrl: c.designImage || c.imageUrl || ''
        }
      ]
    };
    setBillingChallanData(challanData);
    setOverrideSubTab('billing');
  };

  const openNew  = () => {
    setFormCard(null);
    setShowForm(true);
  };
  const openEdit = (c) => { setFormCard(c); setShowForm(true); };
  const onSaved  = () => {
    setShowForm(false);
    triggerGlobalDataRefresh('jobcards');
    fetchCards();
  };

  const MACHINE_COLOR = { GRANDO:'#3b82f6', PRINTDOT:'#ef4444' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%', alignItems: 'stretch' }}>
      {department === 'stitching' && (effectiveSubTab === 'dashboard' || effectiveSubTab === 'list' || effectiveSubTab === 'jobcards' || !effectiveSubTab) ? (
        <GarmentJobCardDashboard />
      ) : department === 'stitching' && (effectiveSubTab === 'challan' || effectiveSubTab === 'fabric_challan' || effectiveSubTab === 'stitching_challan') ? (
        <StitchingChallanPanel onNavigateToBilling={(ch) => { setBillingChallanData(ch); setOverrideSubTab('billing'); }} />
      ) : effectiveSubTab === 'catalogue' || effectiveSubTab === 'master' || effectiveSubTab === 'sample' || effectiveSubTab === 'sample_design' ? (
        <DesignCatalogue 
          department={department} 
          currentUser={currentUser}
          initialSubTab={effectiveSubTab === 'master' ? 'master' : (effectiveSubTab === 'sample' || effectiveSubTab === 'sample_design') ? 'sample' : 'catalogue'} 
        />
      ) : effectiveSubTab === 'fabric' ? (
        <FabricInventoryPanel department={department} onNavigateToBilling={(ch) => { setBillingChallanData(ch); setOverrideSubTab('billing'); }} />
      ) : effectiveSubTab === 'costing' || effectiveSubTab === 'costing_pl' ? (
        <DigitalPrintCostingScreen companyEntity={department === 'stitching' ? "Elite Stitching" : "Elite Digital Print"} />
      ) : effectiveSubTab === 'billing' || effectiveSubTab === 'billing_digital' || effectiveSubTab === 'billing_elite' ? (
        <EliteBillingDepartment initialChallanData={billingChallanData} department={department} companyEntity={department === 'stitching' ? "Elite Stitching" : "Elite Digital Print"} />
      ) : effectiveSubTab === 'billing_fabtex' ? (
        <EliteBillingDepartment initialChallanData={billingChallanData} department={department} companyEntity="Elite Fabtex" />
      ) : effectiveSubTab === 'printing_log' || effectiveSubTab === 'print_entry' ? (
        <JobPrintingLog />
      ) : effectiveSubTab === 'fusing_log' || effectiveSubTab === 'fusing' ? (
        <FusingDepartment />
      ) : effectiveSubTab === 'qa' || effectiveSubTab === 'quality' || effectiveSubTab === 'quality_checking' ? (
        <QADepartment department={department} />
      ) : effectiveSubTab === 'engine' || effectiveSubTab === 'split_view' ? (
        <EliteDigitalPrintsSplitView />
      ) : effectiveSubTab === 'raw_materials' ? (
        <RawMaterialsPanel />
      ) : effectiveSubTab === 'complain' || effectiveSubTab === 'complaint' || effectiveSubTab === 'complaints' ? (
        <DigitalPrintComplainModule companyEntity={department === 'stitching' ? "Elite Stitching" : "Elite Digital Print"} />
      ) : effectiveSubTab === 'expense' || effectiveSubTab === 'expenses' ? (
        <DigitalPrintExpenseModule companyEntity={department === 'stitching' ? "Elite Stitching" : "Elite Digital Print"} />
      ) : effectiveSubTab === 'settings' || effectiveSubTab === 'stitching_settings' ? (
        department === 'stitching' ? <StitchingSettings /> : <PrintSettings />
      ) : effectiveSubTab === 'status_dashboard' || effectiveSubTab === 'jobcards_status' || effectiveSubTab === 'pending_summary' || effectiveSubTab === 'status_overview' ? (
        <JobCardStatusDashboard onSelectCard={c => openEdit(c)} department={department} />
      ) : effectiveSubTab === 'reports' || effectiveSubTab === 'reports_center' ? (
        <ReportsCenter department={department === 'stitching' ? 'stitching' : 'elite-print'} />
      ) : effectiveSubTab === 'jobcards' || effectiveSubTab === 'dashboard' ? (
        department === 'stitching' ? <GarmentJobCardDashboard /> : <DigitalPrintOperationsDashboard onNavigateDepartment={(tab) => setOverrideSubTab(tab)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Enterprise Header Banner */}
          <div className="ent-screen-header">
            <div className="ent-header-title-wrap">
              <div className="ent-header-icon-box" style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}>
                <FileText size={18} />
              </div>
              <div>
                <h2 className="ent-header-title">
                  {department === 'stitching' ? 'Stitching Job Cards' : 'Job Cards & Production'}
                </h2>
                <p className="ent-header-meta">
                  <strong style={{ color: 'var(--primary)' }}>{total}</strong> Total Cards • <strong style={{ color: '#059669' }}>{(Number(totalMtr) || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong> Mtr
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="ent-header-actions">
              <button
                type="button"
                className="ent-btn ent-btn-primary"
                onClick={openNew}
              >
                <PlusCircle size={14} /> <span>New Job Card</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="ent-tab-bar" style={{ margin: '0 0 0.2rem 0' }}>
            <button
              type="button"
              onClick={() => setOverrideSubTab('list')}
              className={`ent-tab-btn ${(effectiveSubTab === 'list' || (effectiveSubTab !== 'tracking' && effectiveSubTab !== 'status_dashboard' && effectiveSubTab !== 'pending_summary' && effectiveSubTab !== 'status_overview')) ? 'active' : ''}`}
            >
              <FileText size={14} />
              <span>Production Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setOverrideSubTab('tracking')}
              className={`ent-tab-btn ${effectiveSubTab === 'tracking' ? 'active' : ''}`}
            >
              <RefreshCw size={14} />
              <span>Tracking</span>
            </button>
          </div>

          {effectiveSubTab === 'tracking' ? (
            <JobCardTracking onPreview={setPreviewCard} />
          ) : (effectiveSubTab === 'status_dashboard' || effectiveSubTab === 'pending_summary' || effectiveSubTab === 'status_overview') ? (
            <JobCardStatusDashboard onSelectCard={c => openEdit(c)} department={department} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

      {/* Filters */}
      <div className="glass-panel" style={{ padding:'1rem 1.25rem' }}>
        <div style={{ display:'flex', gap:'0.8rem', alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:'1 1 220px' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input type="text" value={search} onChange={e=>{ setSearch(e.target.value); }}
              placeholder="Search Job No., Party, Design…"
              style={{ paddingLeft:32, width:'100%', fontSize:'0.85rem' }}/>
          </div>
          <DateRangePicker
            preset={datePreset}
            onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
              setDatePreset(p);
              setDateStart(ds);
              setDateEnd(de);
              setPage(1);
            }}
            customStart={customDateStart}
            customEnd={customDateEnd}
            onCustomChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
            }}
          />
          {/* Unified Filter Popover */}
          <UnifiedFilterPopover
            filters={jobCardFilters}
            values={jobCardFilterValues}
            onChange={handleJobCardFilterChange}
            onClear={handleClearAllJobCardFilters}
            triggerLabel="Filters"
            showChips={true}
          />
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(16, 185, 129, 0.12))',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}>
            <span style={{ color: '#38bdf8' }}>📊 {statusFilter}:</span>
            <span style={{ color: '#a78bfa' }}><strong>{total}</strong> Cards</span>
            <span style={{ color: 'var(--border-light)', margin: '0 1px' }}>•</span>
            <span style={{ color: '#34d399' }}><strong>{(Number(totalMtr) || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong> Mtr</span>
          </div>

          <button onClick={() => { setSortBy(prev => prev === 'urgency' ? '' : 'urgency'); setPage(1); }}
            style={{ padding:'0.45rem 0.9rem', fontSize:'0.8rem', borderRadius:'var(--radius-sm)',
              fontFamily:'var(--font-sans)', fontWeight:600, cursor:'pointer', border:'1px solid',
              borderColor: sortBy==='urgency' ? '#fbbf24' : 'var(--border-light)',
              background: sortBy==='urgency' ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: sortBy==='urgency' ? '#fbbf24' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.45rem', transition: 'all 0.15s' }}>
            🔥 Urgency Priority
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
          {/* Bulk Job Cards Selection Action Bar */}
          {selectedJobCardIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '10px', marginBottom: '1rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={16} color="#34d399" />
                <span>{selectedJobCardIds.length} Job Card{selectedJobCardIds.length > 1 ? 's' : ''} Selected</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={handleBulkPrintSelectedJobCards}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Download size={15} />
                  Download Combined PDF ({selectedJobCardIds.length})
                </button>
                <button
                  onClick={() => setSelectedJobCardIds([])}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {viewMode === 'list' ? (
            <div className="table-responsive-wrapper" style={{ margin: '0 0 1rem 0' }}>
              <div className="table-responsive" style={{ padding: 0 }}>
              {(() => {
                const displayedCards = cards.filter(c => matchSearchQuery(c, debouncedSearch, ['jobNo', 'party', 'designNo', 'designName', 'machineName', 'billNo', 'partyChallan', 'ourChallanNo', 'lotNo', 'fabric']));
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '0.75rem 0.5rem', width: '42px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={displayedCards.length > 0 && displayedCards.every(c => selectedJobCardIds.includes(c._id))}
                            onChange={() => handleToggleSelectAllJobCards(displayedCards)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                            title="Select All Job Cards"
                          />
                        </th>
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
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created By</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCards.map(c => (
                        <tr 
                          key={c._id} 
                          style={{ borderBottom: '1px solid var(--border-light)', background: selectedJobCardIds.includes(c._id) ? 'rgba(16, 185, 129, 0.08)' : 'transparent', transition: 'background-color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = selectedJobCardIds.includes(c._id) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.015)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = selectedJobCardIds.includes(c._id) ? 'rgba(16, 185, 129, 0.08)' : ''}
                        >
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedJobCardIds.includes(c._id)}
                              onChange={() => handleToggleSelectJobCard(c._id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                            />
                          </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <JobCardTooltip card={c}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--primary)', cursor: 'pointer' }}>{c.jobNo}</span>
                            {c.emergencyNotes && c.emergencyNotes.trim() && (
                              <span title="Urgent" style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.6rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>URGENT</span>
                            )}
                          </div>
                        </JobCardTooltip>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.party || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>{c.designName || c.designNo || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.fabric || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.colors || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.panna || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{c.totalMtr || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{formatDateDDMMYYYY(c.date)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {String(c.createdByName || c.createdBy || '').toLowerCase().includes('client') ? (
                          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>📱</span>
                            <span>{c.createdByName || c.createdBy}</span>
                          </span>
                        ) : (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.12)', color: '#a78bfa', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(124, 58, 237, 0.25)' }}>
                            {c.createdByName || c.createdBy || 'Staff User'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', minWidth: '160px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <WorkflowStageBadge card={c} />
                            <StatusBadge status={c.status} />
                          </div>
                          <JobStageProgressBar
                            card={c}
                            department={department}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        {(() => {
                          const pStatus = (c.printStatus || '').toLowerCase();
                          const isPrintDone = pStatus.includes('done') || parseFloat(c.printMtr || 0) > 0;
                          const fStatus = (c.fusingStatus || '').toLowerCase();
                          const fusedMtr = parseFloat(c.fusingMtr || c.freshMtr || 0);
                          const isFusingDone = fStatus.includes('done');
                          const isReadyForChallan = isPrintDone && (isFusingDone || fusedMtr > 0);

                          const rowActions = [
                            {
                              id: 'challan',
                              icon: Receipt,
                              label: 'Billing / Challan',
                              tooltip: isReadyForChallan ? 'Send to Billing / Create Challan' : 'Billing (Pending Finish)',
                              variant: isReadyForChallan ? 'purple' : 'default',
                              color: isReadyForChallan ? '#8b5cf6' : '#94a3b8',
                              onClick: () => handleSendToBilling(c),
                              isPrimary: true
                            },
                            {
                              id: 'print',
                              icon: Printer,
                              label: 'Print / PDF',
                              tooltip: 'Print or Save PDF',
                              variant: 'success',
                              color: '#10b981',
                              onClick: () => triggerJobCardPrint(c),
                              isPrimary: true
                            },
                            {
                              id: 'preview',
                              icon: Eye,
                              label: 'Preview',
                              tooltip: 'Quick Preview Job Card',
                              variant: 'default',
                              onClick: () => setPreviewCard(c),
                              isPrimary: false
                            },
                            {
                              id: 'history',
                              icon: Clock,
                              label: 'Audit Log',
                              tooltip: 'View Staff History & Mistakes Log',
                              variant: 'warning',
                              color: '#fbbf24',
                              onClick: () => setHistoryModalCard(c),
                              isPrimary: false
                            },
                            {
                              id: 'edit',
                              icon: Edit2,
                              label: 'Edit',
                              tooltip: 'Edit Job Card',
                              variant: 'primary',
                              onClick: () => openEdit(c),
                              isPrimary: false
                            },
                            {
                              id: 'share',
                              icon: Send,
                              label: 'Share',
                              tooltip: 'Share Job Card to Chat',
                              variant: 'default',
                              color: '#60a5fa',
                              onClick: () => handleOpenShareModal(c),
                              isPrimary: false
                            },
                            {
                              id: 'delete',
                              icon: Trash2,
                              label: 'Delete',
                              tooltip: 'Delete Job Card',
                              variant: 'danger',
                              color: '#f87171',
                              onClick: () => handleDelete(c._id, c.jobNo),
                              isPrimary: false
                            }
                          ];

                          return <SmartActionGroup actions={rowActions} maxInlineMobile={2} align="center" />;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:'1.25rem' }}>
              {displayedCards.map(c => {
                const pStatus = (c.printStatus || '').toLowerCase();
                const isPrintDone = pStatus.includes('done') || parseFloat(c.printMtr || 0) > 0;
                const fStatus = (c.fusingStatus || '').toLowerCase();
                const fusedMtr = parseFloat(c.fusingMtr || c.freshMtr || 0);
                const isFusingDone = fStatus.includes('done');
                const isReadyForChallan = isPrintDone && (isFusingDone || fusedMtr > 0);

                const isGrando = c.machineName === 'GRANDO';

                return (
                  <div
                    key={c._id}
                    className="glass-panel job-card-item"
                    style={{
                      padding: '1.15rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderRadius: '16px',
                      background: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(15,23,42,0.08), 0 8px 10px -6px rgba(15,23,42,0.04)';
                      e.currentTarget.style.borderColor = '#bfdbfe';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)';
                      e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
                    }}
                  >
                    {/* Header Row 1: Job Number & Machine (Left) + Urgent & Status (Right) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* Left: Job Number & Machine Identifier (Guaranteed No Overlap) */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexShrink: 0
                        }}
                      >
                        <JobCardTooltip card={c} style={{ flexShrink: 0 }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.96rem',
                              color: 'var(--primary, #2563eb)',
                              cursor: 'pointer',
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}
                          >
                            {c.jobNo}
                          </span>
                        </JobCardTooltip>

                        {c.machineName && (
                          <span
                            style={{
                              flexShrink: 0,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.67rem',
                              fontWeight: 800,
                              letterSpacing: '0.03em',
                              whiteSpace: 'nowrap',
                              background: isGrando ? '#eff6ff' : '#f5f3ff',
                              color: isGrando ? '#1d4ed8' : '#7c3aed',
                              border: `1px solid ${isGrando ? '#bfdbfe' : '#ddd6fe'}`
                            }}
                          >
                            {c.machineName}
                          </span>
                        )}
                      </div>

                      {/* Right: Urgent Indicator & Operational Status */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0
                        }}
                      >
                        {c.emergencyNotes && c.emergencyNotes.trim() && (
                          <span
                            style={{
                              flexShrink: 0,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            URGENT
                          </span>
                        )}

                        <StatusBadge status={c.status} />
                      </div>
                    </div>

                    {/* Header Row 2: Production Stage Pill & Date */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <WorkflowStageBadge card={c} />
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        📅 {formatDateDDMMYYYY(c.date)}
                      </span>
                    </div>

                    {/* Segmented Production Stage Progress Bar */}
                    <div style={{ margin: '4px 0 6px 0', width: '100%' }}>
                      <JobStageProgressBar
                        card={c}
                        department={department}
                      />
                    </div>

                    {/* Highlight Banner: Party & Design Name */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                        background: 'var(--bg-subtle, #f8fafc)',
                        border: '1px solid var(--border-light, #e2e8f0)',
                        borderRadius: '10px',
                        padding: '0.55rem 0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Party
                        </span>
                        <span
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: 'var(--text-primary, #0f172a)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={c.party || '—'}
                        >
                          {c.party || '—'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Design
                        </span>
                        <span
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: 'var(--primary, #2563eb)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={c.designName || c.designNo || '—'}
                        >
                          {c.designName || c.designNo || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Fabric Spec Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 700, flexShrink: 0, textTransform: 'uppercase', fontSize: '0.66rem' }}>
                        Fabric:
                      </span>
                      <span
                        style={{
                          color: 'var(--text-primary, #1e293b)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={c.fabric || '—'}
                      >
                        {c.fabric || '—'}
                      </span>
                    </div>

                    {/* Personnel Row: Designer & Color Matching */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.76rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600, flexShrink: 0 }}>Designer:</span>
                        <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.designer || '—'}>
                          {c.designer || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600, flexShrink: 0 }}>C.Match:</span>
                        <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.colourMatching || '—'}>
                          {c.colourMatching || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Key Production Metrics Strip: Total Mtr & Expected Time */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <div
                        style={{
                          background: 'var(--bg-subtle, #f8fafc)',
                          border: '1px solid var(--border-light, #e2e8f0)',
                          borderRadius: '8px',
                          padding: '0.4rem 0.65rem',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                          Total Mtr
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                          {c.totalMtr ? `${c.totalMtr} Mtr` : '—'}
                        </span>
                      </div>

                      <div
                        style={{
                          background: 'var(--bg-subtle, #f8fafc)',
                          border: '1px solid var(--border-light, #e2e8f0)',
                          borderRadius: '8px',
                          padding: '0.4rem 0.65rem',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                          Exp. Time
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary, #2563eb)' }}>
                          {c.expTime || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Subtle Creator Footnote */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted, #94a3b8)',
                        marginTop: '-0.1rem'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} style={{ opacity: 0.7 }} />
                        <span>By {c.createdByName || c.createdBy || 'Staff User'}</span>
                      </span>
                      {c.lotNo && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
                          Lot: {c.lotNo}
                        </span>
                      )}
                    </div>

                    {/* Card Actions: Primary Operations (Tier 1) + Secondary Utilities (Tier 2) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        borderTop: '1px solid var(--border-light, #e2e8f0)',
                        paddingTop: '0.75rem',
                        marginTop: 'auto'
                      }}
                    >
                      {/* Tier 1: Primary Operation Buttons (Challan & Print) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                        <button
                          type="button"
                          onClick={() => handleSendToBilling(c)}
                          title={isReadyForChallan ? 'Create Delivery Challan' : 'Printing or Fusing in Progress'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            padding: '0.44rem 0.6rem',
                            borderRadius: '8px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isReadyForChallan ? 'linear-gradient(135deg, #4f46e5, #4338ca)' : '#f1f5f9',
                            color: isReadyForChallan ? '#ffffff' : '#64748b',
                            border: isReadyForChallan ? 'none' : '1px solid #cbd5e1',
                            boxShadow: isReadyForChallan ? '0 2px 6px rgba(79,70,229,0.25)' : 'none',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <FileText size={13} />
                          <span>{isReadyForChallan ? 'Challan ✓' : 'Challan'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerJobCardPrint(c)}
                          title="Print or Save PDF"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            padding: '0.44rem 0.6rem',
                            borderRadius: '8px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Printer size={13} />
                          <span>Print</span>
                        </button>
                      </div>

                      {/* Tier 2: Secondary Utilities (Edit, Preview, History, Share, Delete) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          paddingTop: '0.1rem'
                        }}
                      >
                        <SmartIconButton
                          icon={Edit2}
                          tooltip="Edit Job Card"
                          onClick={() => openEdit(c)}
                          variant="primary"
                          style={{ flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                        <SmartIconButton
                          icon={Eye}
                          tooltip="Full Preview"
                          onClick={() => setPreviewCard(c)}
                          variant="default"
                          style={{ flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                        <SmartIconButton
                          icon={Clock}
                          tooltip="Audit History & Log"
                          onClick={() => setHistoryModalCard(c)}
                          variant="warning"
                          style={{ flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                        <SmartIconButton
                          icon={Send}
                          tooltip="Share Job Card"
                          onClick={() => handleOpenShareModal(c)}
                          variant="default"
                          style={{ flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                        <SmartIconButton
                          icon={Trash2}
                          tooltip="Delete Job Card"
                          onClick={() => handleDelete(c._id, c.jobNo)}
                          variant="danger"
                          style={{ flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll & Pagination */}
          <InfiniteScrollPagination
            hasMore={pageSize !== 'all' && page < pages}
            loading={loading && cards.length === 0}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            page={page}
            pages={pages}
            total={total}
            currentCount={cards.length}
            itemName="job cards"
            pageSize={pageSize}
            pageSizeOptions={[25, 50, 100, 250, 'All']}
            onPageSizeChange={(newSize) => {
              const s = newSize === 'All' ? 'all' : Number(newSize);
              setPageSize(s);
              pageSizeRef.current = s;
              setPage(1);
              pageRef.current = 1;
              fetchCards(false, 1, s);
            }}
            onLoadAll={() => {
              setPageSize('all');
              pageSizeRef.current = 'all';
              setPage(1);
              pageRef.current = 1;
              fetchCards(false, 1, 'all');
            }}
            onFirstPage={() => {
              setPage(1);
              pageRef.current = 1;
              fetchCards(false, 1, pageSizeRef.current);
            }}
            onLastPage={() => {
              setPage(pages);
              pageRef.current = pages;
              fetchCards(false, pages, pageSizeRef.current);
            }}
            onPageChange={(targetPage) => {
              const p = Math.max(1, Math.min(pages, targetPage));
              setPage(p);
              pageRef.current = p;
              fetchCards(false, p, pageSizeRef.current);
            }}
            onPrevPage={() => {
              const prevPage = Math.max(1, page - 1);
              setPage(prevPage);
              pageRef.current = prevPage;
              fetchCards(false, prevPage, pageSizeRef.current);
            }}
            onNextPage={() => {
              if (page < pages) {
                const nextPage = page + 1;
                setPage(nextPage);
                pageRef.current = nextPage;
                fetchCards(false, nextPage, pageSizeRef.current);
              }
            }}
          />
        </>
      )}

      {/* Modals */}
      {showForm && (
        <JobCardForm card={formCard} onSave={onSaved} onClose={()=>setShowForm(false)} department={department}/>
      )}
      {previewCard && (
        <ErrorBoundary>
          <JobCardPrintView 
            card={previewCard} 
            onClose={()=>setPreviewCard(null)}
            onShare={(c) => {
              handleOpenShareModal(c);
            }}
          />
        </ErrorBoundary>
      )}

      {/* 🌟 SHARE TO CHAT FLOATING MODAL 🌟 */}
      {showShareModal && (() => {
        const COMPANY_OPTIONS = [
          { id: 'Elite Digital Print', label: '🖨️ Digital Print', color: '#2563eb' },
          { id: 'Elite Online', label: '🛍️ Online', color: '#9333ea' },
          { id: 'Elite Edition', label: '🏢 Edition', color: '#0284c7' },
          { id: 'Elite Fabtex', label: '🧵 Fabtex', color: '#d97706' },
          { id: 'Elite Stitching', label: '✂️ Stitching', color: '#16a34a' },
          { id: '', label: '🌐 All Channels', color: '#475569' }
        ];

        const selectedRoom = chatRooms.find(r => String(r._id) === String(selectedRoomId));

        const filteredRooms = chatRooms.filter(r => {
          if (shareCompanyFilter) {
            const cLow = shareCompanyFilter.toLowerCase();
            const rName = (r.name || '').toLowerCase();
            const rComp = (r.companyEntity || '').toLowerCase();
            const isMatch = r.type !== 'direct' && (
              (cLow.includes('print') && (rComp.includes('print') || rName.includes('print'))) ||
              (cLow.includes('online') && (rComp.includes('online') || rName.includes('sales'))) ||
              (cLow.includes('stitching') && (rComp.includes('stitching') || rName.includes('stitching'))) ||
              (cLow.includes('fabtex') && (rComp.includes('fabtex') || rName.includes('fabtex'))) ||
              (cLow.includes('edition') && (rComp.includes('edition') || rName.includes('operations'))) ||
              rComp.includes(cLow) || rName.includes(cLow)
            );
            if (!isMatch) return false;
          }
          if (!shareSearch) return true;
          const roomName = r.type === 'direct' 
            ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || '')
            : (r.name || '');
          return roomName.toLowerCase().includes(shareSearch.toLowerCase());
        });

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: '#0f172a'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '1.1rem 1.4rem',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Send size={20} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                      Share Job Card {shareCard?.jobNo ? `— #${shareCard.jobNo}` : ''}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                      Send directly into company team channels or private messages.
                    </p>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); setShareNote(''); }} 
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleShareJobCard} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 📋 Job Card Mini Context Card */}
                {shareCard && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.8rem'
                  }}>
                    <span style={{ fontWeight: 800, color: '#2563eb' }}>JC #{shareCard.jobNo}</span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Party: <strong>{shareCard.party || 'Client'}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>{shareCard.totalMtr || 0} Mtr</span>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem' }}>
                      {shareCard.currentStage || shareCard.status || 'Active'}
                    </span>
                  </div>
                )}

                {/* 🏢 Quick Company Filter Pills */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                      🏢 Select Company
                    </label>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Filters channels &amp; auto-selects direct group
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {COMPANY_OPTIONS.map(opt => {
                      const isSelected = shareCompanyFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectShareCompany(opt.id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '20px',
                            border: isSelected ? `2px solid ${opt.color}` : '1px solid #cbd5e1',
                            background: isSelected ? `${opt.color}15` : '#ffffff',
                            color: isSelected ? opt.color : '#475569',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {opt.label}
                          {isSelected && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ⚡ 1-Click Direct Share Banner */}
                {selectedRoom ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1d4ed8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⚡ 1-Click Destination</span>
                        {selectedRoom.companyEntity && (
                          <span style={{ background: '#bfdbfe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontSize: '0.66rem' }}>
                            {selectedRoom.companyEntity}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        #{selectedRoom.name}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleShareJobCard}
                      disabled={sharingJobCard}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 18px',
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: sharingJobCard ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                        flexShrink: 0
                      }}
                    >
                      {sharingJobCard ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                      <span>{sharingJobCard ? 'Sending...' : '🚀 Send Directly Now'}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#92400e',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    ⚠️ Please select a channel below to send this job card.
                  </div>
                )}

                {/* 💬 Optional Note Input */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                    💬 Optional Note / Instruction (Shared with Job Card)
                  </label>
                  <input 
                    type="text" 
                    value={shareNote} 
                    onChange={e => setShareNote(e.target.value)} 
                    placeholder="e.g. Urgent production run, please prioritize printing..." 
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                      fontSize: '0.84rem'
                    }}
                  />
                </div>

                {/* 🔍 Search & Channels Roster */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                      Destination Channels ({filteredRooms.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => loadShareRooms(shareCard, true)}
                      disabled={loadingShareRooms}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RefreshCw size={12} className={loadingShareRooms ? 'animate-spin' : ''} />
                      Sync Channels
                    </button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: '6px' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text" 
                      value={shareSearch} 
                      onChange={e => setShareSearch(e.target.value)} 
                      placeholder="Search channel or member name..." 
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.8rem 0.5rem 2rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>

                  <div style={{
                    maxHeight: '170px',
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '6px',
                    backgroundColor: '#f8fafc'
                  }}>
                    {loadingShareRooms ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Loader size={20} className="animate-spin" color="#2563eb" />
                        <span>Loading team communication channels...</span>
                      </div>
                    ) : filteredRooms.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                        <p style={{ margin: '0 0 8px 0' }}>No active channels found for this filter.</p>
                        <button
                          type="button"
                          onClick={() => { setShareCompanyFilter(''); setShareSearch(''); loadShareRooms(shareCard, true); }}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🔄 Reset Filters &amp; Sync Groups
                        </button>
                      </div>
                    ) : (
                      filteredRooms.map(r => {
                        const isDirect = r.type === 'direct';
                        const displayName = isDirect 
                          ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || 'Direct Message')
                          : r.name;
                        const isSelected = selectedRoomId === r._id;
                        
                        return (
                          <div 
                            key={r._id} 
                            onClick={() => setSelectedRoomId(r._id)}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                              border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                              color: isSelected ? '#1d4ed8' : '#0f172a',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: isSelected
                                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                : '#e2e8f0',
                              color: isSelected ? '#ffffff' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              flexShrink: 0
                            }}>
                              {isDirect ? displayName.charAt(0).toUpperCase() : '#'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {displayName}
                              </div>
                              {r.companyEntity && (
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {r.companyEntity}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <span style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 900 }}>✓</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Bottom action controls */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                  <button 
                    type="button" 
                    onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); setShareNote(''); }} 
                    className="btn-secondary"
                    style={{
                      padding: '0.5rem 1.1rem',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 700
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={sharingJobCard || !selectedRoomId}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedRoomId ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
                      color: 'white',
                      cursor: selectedRoomId ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: selectedRoomId ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
                      opacity: selectedRoomId ? 1 : 0.6
                    }}
                  >
                    {sharingJobCard ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                    <span>{sharingJobCard ? 'Sharing...' : 'Confirm Share'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Staff Audit History & Mistakes Tracker Modal */}
      {historyModalCard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '640px', background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '14px', padding: '1.25rem', color: '#0f172a', boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} /> Job Card #{historyModalCard.jobNo} — Staff Audit History
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Complete timeline of every staff member who created or edited this Job Card.
                </p>
              </div>
              <button className="btn-icon" onClick={() => setHistoryModalCard(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(!historyModalCard.auditTrail || historyModalCard.auditTrail.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Created By: <span style={{ color: '#2563eb' }}>{historyModalCard.createdByName || historyModalCard.createdBy || 'Staff User'}</span></div>
                  {historyModalCard.updatedByName && (
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Last Updated By: <span style={{ color: '#0284c7' }}>{historyModalCard.updatedByName}</span></div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>No detailed field changes recorded prior to system upgrade.</div>
                </div>
              ) : (
                historyModalCard.auditTrail.map((entry, idx) => (
                  <div key={idx} style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: entry.action === 'CREATE' ? '#16a34a' : '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👤 {entry.performedByName || entry.performedBy || 'Staff User'}</span>
                        <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: entry.action === 'CREATE' ? '#dcfce7' : '#e0f2fe', color: entry.action === 'CREATE' ? '#15803d' : '#0369a1', border: `1px solid ${entry.action === 'CREATE' ? '#bbf7d0' : '#bae6fd'}` }}>
                          {entry.action}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {new Date(entry.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, background: '#ffffff', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      {entry.details || entry.changesSummary || 'Updated Job Card'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
          </div>
        )}
      </div>
    )}
  </div>
);
}
