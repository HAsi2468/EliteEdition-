/**
 * Controller: Digital QR Code Physical Job Card Verification & Public Viewer
 *
 * Provides instant public verification and mobile-friendly full view of Job Cards
 * when scanning the physical QR code on printed Job Cards.
 */

const mongoose = require('mongoose');
const db = require('../db/models');
const { normalizeImageUrl } = require('../utils/imageUrlHelper');

const R2_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

/**
 * Generate candidate URLs for a design image so that if one URL fails,
 * the frontend automatically falls back to subsequent candidates.
 */
function getDesignCandidates(rawUrl, designName) {
  const candidates = [];
  const add = (u) => {
    if (u && typeof u === 'string' && u.trim()) {
      const clean = u.trim();
      if (!candidates.includes(clean)) candidates.push(clean);
    }
  };

  const raw = (rawUrl || '').trim();
  const dName = (designName || '').trim();

  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    add(raw);
  }

  const cleanDesign = dName.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '').trim();

  if (raw) {
    const fn = raw.split('/').pop().split('?')[0].split('#')[0];
    if (fn) {
      add(`${R2_BASE}/designs/${encodeURIComponent(fn)}`);
      add(`/v1/designs/${encodeURIComponent(fn)}`);
    }
  }

  if (cleanDesign) {
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`/v1/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpeg`);
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.png`);

    const stripped = cleanDesign.replace(/\s+[A-Za-z0-9]$/, '').trim();
    if (stripped && stripped !== cleanDesign) {
      add(`${R2_BASE}/designs/${encodeURIComponent(stripped)}.jpg`);
      add(`/v1/designs/${encodeURIComponent(stripped)}.jpg`);
    }

    const strippedParens = cleanDesign.replace(/\([0-9]+\)$/, '').trim();
    if (strippedParens && strippedParens !== cleanDesign) {
      add(`${R2_BASE}/designs/${encodeURIComponent(strippedParens)}.jpg`);
      add(`/v1/designs/${encodeURIComponent(strippedParens)}.jpg`);
    }
  }

  return candidates;
}

/**
 * Endpoint: Verify and view Job Card by Job No or ObjectId
 * GET /verify/jobcard/:id
 * GET /v1/verify/jobcard/:id
 */
const verifyJobCard = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.trim()) {
      return res.status(400).json({ success: false, error: 'Job Card identifier is required.' });
    }

    const cleanParam = String(id).trim();
    let card = null;

    if (mongoose.Types.ObjectId.isValid(cleanParam)) {
      card = await db.JobCard.findById(cleanParam).lean();
    }

    if (!card) {
      const numMatch = cleanParam.match(/\d+/);
      const digits = numMatch ? numMatch[0] : '';
      const num = digits ? parseInt(digits, 10) : null;
      
      const orConditions = [
        { jobNo: cleanParam },
        { jobNo: cleanParam.toLowerCase() },
        { jobNo: cleanParam.toUpperCase() }
      ];
      if (digits) {
        orConditions.push({ jobNo: digits });
        orConditions.push({ jobNo: new RegExp(`(JOB|JC)[^0-9]*${digits}$`, 'i') });
        orConditions.push({ jobNo: new RegExp(`^${digits}$`, 'i') });
      }
      if (num !== null && !isNaN(num)) {
        orConditions.push({ jobNo: num });
      }
      card = await db.JobCard.findOne({ $or: orConditions }).lean();
    }

    if (!card) {
      if (req.accepts('html')) {
        return res.status(404).send(renderInvalidJobCardHtml(cleanParam));
      }
      return res.status(404).json({
        success: false,
        error: 'JOB_CARD_NOT_FOUND',
        message: `Job Card '${cleanParam}' was not found in the ERP database.`
      });
    }

    // Auto-fill calculated fields
    const pcsNum = parseFloat(card.pcs) || 0;
    const mtrNum = parseFloat(card.totalMtr) || 0;
    const consNum = parseFloat(card.consumption) || 0;
    if (!card.consumption && mtrNum > 0 && pcsNum > 0) {
      card.consumption = (mtrNum / pcsNum).toFixed(2);
    }
    if (!card.totalMtr && consNum > 0 && pcsNum > 0) {
      card.totalMtr = (consNum * pcsNum).toFixed(2);
    }

    const raw1 = card.imageUrl1 || card.imageUrl;
    const raw2 = card.imageUrl2;
    card.imageUrl1 = normalizeImageUrl(raw1, card.designName || card.designNo);
    card.imageUrl2 = normalizeImageUrl(raw2, card.designName ? `${card.designName}-2` : '');

    const candidates1 = getDesignCandidates(raw1 || card.imageUrl1, card.designName || card.designNo);
    const candidates2 = getDesignCandidates(raw2 || card.imageUrl2, card.designName ? `${card.designName}-2` : '');

    const nonce = res.locals.cspNonce || '';

    if (req.accepts('html')) {
      return res.status(200).send(renderValidJobCardHtml(card, { candidates1, candidates2, nonce }));
    }

    return res.json({
      success: true,
      verified: true,
      data: card
    });
  } catch (err) {
    console.error('Error verifying job card:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

/**
 * HTML Template for Valid Job Card with authentic Job Card Layout & High-Res Zoomable Design Preview
 */
function renderValidJobCardHtml(card, options = {}) {
  const { candidates1 = [], candidates2 = [], nonce = '' } = options;
  const jobNo = card.jobNo || '—';
  const designNo = card.designNo || card.designName || '—';
  const machine = (card.machineName || 'PRINTDOT').toUpperCase();
  const machineBg = machine === 'GRANDO' ? '#0b5394' : '#cc0000';

  const dateStr = card.date
    ? (card.date.includes('-') ? card.date.split('-').reverse().join('/') : card.date)
    : '—';
  const printDateStr = card.printDate
    ? (card.printDate.includes('-') ? card.printDate.split('-').reverse().join('/') : card.printDate)
    : '—';

  // Compute Stage
  const pStatus = (card.printStatus || '').toLowerCase();
  const isPrintDone = pStatus.includes('done') || parseFloat(card.printMtr || 0) > 0;
  const fStatus = (card.fusingStatus || '').toLowerCase();
  const fusedMtr = parseFloat(card.fusingMtr || card.freshMtr || 0);
  const isFusingDone = fStatus.includes('done');
  const deliveredMtr = parseFloat(card.deliveredMtr || 0);
  const totalMtr = parseFloat(card.totalMtr || card.totalQty || 0);
  const isDispatched = (card.deliveryStatus || '').toLowerCase().includes('done') || (totalMtr > 0 && deliveredMtr >= totalMtr);

  let stageLabel = '1. Printing Pending';
  let stageColor = '#b45309';
  let stageBg = '#fffbeb';
  let stageBorder = '#fde68a';

  if (isDispatched) {
    stageLabel = `4. Dispatched (${deliveredMtr}m)`;
    stageColor = '#047857';
    stageBg = '#ecfdf5';
    stageBorder = '#a7f3d0';
  } else if (isFusingDone || fusedMtr > 0) {
    stageLabel = `3. Ready for Challan (${fusedMtr}m Fused)`;
    stageColor = '#1d4ed8';
    stageBg = '#eff6ff';
    stageBorder = '#bfdbfe';
  } else if (isPrintDone) {
    stageLabel = '2. Fusing Pending';
    stageColor = '#d97706';
    stageBg = '#fef3c7';
    stageBorder = '#fde68a';
  }

  const hasImg1 = candidates1.length > 0;
  const hasImg2 = candidates2.length > 0;
  const primaryImg1 = candidates1[0] || card.imageUrl1 || '';
  const primaryImg2 = candidates2[0] || card.imageUrl2 || '';

  const c1Json = JSON.stringify(candidates1).replace(/"/g, '&quot;');
  const c2Json = JSON.stringify(candidates2).replace(/"/g, '&quot;');

  let artworkHtml = '';
  if (hasImg1 && hasImg2) {
    artworkHtml = `
      <div class="artwork-item" onclick="openLightbox(0)" title="Tap to zoom Artwork 1">
        <div class="artwork-tag">TOP / DESIGN 1</div>
        <img class="artwork-img" id="designImg0" src="${primaryImg1}" data-candidates="${c1Json}" data-idx="0" alt="${designNo} - 1" onerror="handleImgError(this)" />
      </div>
      <div class="artwork-item" onclick="openLightbox(1)" title="Tap to zoom Artwork 2">
        <div class="artwork-tag">DUPATTA / DESIGN 2</div>
        <img class="artwork-img" id="designImg1" src="${primaryImg2}" data-candidates="${c2Json}" data-idx="0" alt="${designNo} - 2" onerror="handleImgError(this)" />
      </div>
    `;
  } else if (hasImg1) {
    artworkHtml = `
      <div class="artwork-item" onclick="openLightbox(0)" title="Tap to zoom Design Artwork">
        <img class="artwork-img" id="designImg0" src="${primaryImg1}" data-candidates="${c1Json}" data-idx="0" alt="${designNo}" onerror="handleImgError(this)" />
      </div>
    `;
  } else if (hasImg2) {
    artworkHtml = `
      <div class="artwork-item" onclick="openLightbox(0)" title="Tap to zoom Design Artwork">
        <img class="artwork-img" id="designImg0" src="${primaryImg2}" data-candidates="${c2Json}" data-idx="0" alt="${designNo}" onerror="handleImgError(this)" />
      </div>
    `;
  } else {
    artworkHtml = `
      <div class="no-design-box">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <div style="font-weight: 800; font-size: 11pt; color: #64748b; margin-top: 6px;">NO DESIGN ARTWORK ATTACHED</div>
        <div style="font-size: 9pt; color: #94a3b8;">${designNo}</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
  <title>Job Card #${jobNo} — Elite Digital Prints</title>
  <link rel="icon" type="image/png" href="/DigitalLogo.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #000000; padding: 10px; display: flex; justify-content: center; }
    .card-container { max-width: 650px; width: 100%; background: #ffffff; border: 1.5px solid #000000; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
    
    /* Header */
    .header-bar { display: flex; align-items: stretch; justify-content: space-between; border-bottom: 1.5px solid #000; background: #ffffff; }
    .logo-box { width: 110px; padding: 6px 8px; display: flex; align-items: center; justify-content: center; border-right: 1.5px solid #000; }
    .logo-box img { max-height: 42px; width: 100%; object-fit: contain; }
    .header-center { flex: 1; text-align: center; padding: 4px 6px; display: flex; flex-direction: column; justify-content: center; }
    .company-title { font-size: 14pt; font-weight: 900; letter-spacing: 0.5px; color: #000; text-transform: uppercase; }
    .machine-badge { display: inline-block; background: ${machineBg}; color: #ffffff; font-size: 9pt; font-weight: 800; padding: 2px 20px; border-radius: 2px; margin: 2px auto 0; letter-spacing: 1px; }
    .qr-verified-box { width: 110px; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1.5px solid #000; background: #f8fafc; text-align: center; }
    .verified-pill { font-size: 7.5pt; font-weight: 800; color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 2px; }

    /* Stage Banner */
    .stage-banner { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: ${stageBg}; border-bottom: 1.5px solid #000; font-size: 11.5px; font-weight: 800; color: ${stageColor}; }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: ${stageColor}; display: inline-block; margin-right: 6px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-top: 0; }
    td, th { border: 1px solid #000000; padding: 4px 6px; font-size: 9pt; vertical-align: middle; line-height: 1.25; }
    .label { font-weight: 800; background: #ffffff; width: 16%; white-space: nowrap; font-size: 8pt; text-align: left; }
    .val { font-weight: 600; font-size: 9pt; }
    .val-highlight { font-weight: 800; color: #000000; }
    .total-header { text-align: center; font-weight: 800; font-size: 9pt; background: #ffffff; }
    .total-val { font-weight: 900; font-size: 12pt; padding-left: 8px; }

    /* DESIGN PREVIEW CONTAINER */
    .design-preview-container {
      width: 100%;
      border-bottom: 1.5px solid #000000;
      border-top: 1px solid #000000;
      background: #ffffff;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 250px;
      max-height: 380px;
      overflow: hidden;
      box-sizing: border-box;
    }
    .artworks-flex {
      display: flex;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
    }
    .artwork-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 250px;
      padding: 10px;
      position: relative;
      cursor: zoom-in;
      background: #ffffff;
    }
    .artwork-item + .artwork-item {
      border-left: 1.5px solid #000000;
    }
    .artwork-tag {
      position: absolute;
      top: 8px;
      left: 10px;
      font-size: 7.5pt;
      font-weight: 800;
      background: rgba(0,0,0,0.06);
      color: #334155;
      padding: 2px 6px;
      border-radius: 3px;
      pointer-events: none;
    }
    .artwork-img {
      max-width: 95%;
      max-height: 270px;
      height: auto;
      width: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto;
      transition: transform 0.18s ease-in-out;
    }
    .artwork-item:hover .artwork-img {
      transform: scale(1.02);
    }

    /* Direction Indicator (FONCH) */
    .fonch-badge {
      position: absolute;
      bottom: 6px;
      left: 10px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 8pt;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.5px;
      background: rgba(255, 255, 255, 0.9);
      padding: 2px 6px;
      border-radius: 3px;
      pointer-events: none;
      z-index: 2;
    }
    .fonch-arrow {
      font-size: 11pt;
      line-height: 1;
      color: #000;
    }

    /* Zoom pill */
    .zoom-pill {
      position: absolute;
      top: 8px;
      right: 10px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #0f172a;
      color: #ffffff;
      font-size: 8pt;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      transition: all 0.15s ease;
      z-index: 3;
    }
    .zoom-pill:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }

    .no-design-box {
      text-align: center;
      padding: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Notes */
    .notes-container { border-bottom: 1.5px solid #000; }
    .note-row { padding: 4px 8px; border-bottom: 1px solid #000; font-size: 8pt; font-weight: 700; line-height: 1.3; }
    .note-row:last-child { border-bottom: none; }
    .emrg-note { color: #cc0000; font-weight: 800; }

    /* Fusing & Technical */
    .tech-table { margin-top: 0; }

    /* T.P. Meter Table */
    .tp-table { width: 100%; border-collapse: collapse; margin-top: 0; }
    .tp-label { width: 22px; font-weight: 800; text-align: center; font-size: 7pt; background: #ffffff; padding: 2px; }
    .tp-val { height: 18px; font-size: 7.5pt; text-align: center; padding: 2px; }

    /* Actions Bar */
    .actions-bar { padding: 12px; background: #f8fafc; display: flex; gap: 8px; justify-content: center; border-top: 1px solid #000; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 18px; border-radius: 6px; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; border: none; }
    .btn-primary { background: #2563eb; color: #ffffff; }
    .btn-dark { background: #0f172a; color: #ffffff; }
    .btn-outline { background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; }

    /* Interactive Fullscreen Lightbox */
    .lightbox-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 15, 29, 0.96);
      z-index: 999999;
      display: none;
      flex-direction: column;
      user-select: none;
    }
    .lightbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: rgba(15, 23, 42, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .lightbox-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lightbox-title span:first-child {
      font-weight: 800;
      font-size: 13.5px;
      letter-spacing: 0.5px;
    }
    .lightbox-subtitle {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }
    .lightbox-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .lb-btn {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .lb-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    .lb-close {
      background: #dc2626;
      border-color: #ef4444;
      font-size: 14px;
      padding: 6px 14px;
    }
    .lb-close:hover {
      background: #b91c1c;
    }
    .lightbox-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      padding: 12px;
      position: relative;
      touch-action: pan-x pan-y pinch-zoom;
    }
    .lightbox-image-wrap {
      display: inline-block;
      transition: transform 0.18s cubic-bezier(0.2, 0, 0, 1);
      transform-origin: center center;
    }
    #lbImg {
      max-width: 92vw;
      max-height: 75vh;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      display: block;
      margin: 0 auto;
    }
    .lightbox-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 8px 16px;
      background: rgba(15, 23, 42, 0.9);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      font-size: 11.5px;
    }
    .lb-nav-btn {
      background: #2563eb;
      border: none;
      color: #fff;
      padding: 5px 12px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }

    @media (max-width: 480px) {
      body { padding: 4px; }
      td, th { padding: 3px 4px; font-size: 8pt; }
      .label { font-size: 7.2pt; width: 18%; }
      .company-title { font-size: 12pt; }
      .design-preview-container { min-height: 220px; max-height: 320px; }
      .artwork-img { max-height: 240px; }
      .total-val { font-size: 11pt; }
    }
  </style>
</head>
<body>
  <div class="card-container">
    <!-- HEADER -->
    <div class="header-bar">
      <div class="logo-box">
        <img src="/DigitalLogo.png" alt="Elite Digital Prints" onerror="this.style.display='none'">
      </div>
      <div class="header-center">
        <div class="company-title">ELITE DIGITAL</div>
        <div>
          <span class="machine-badge">${machine}</span>
        </div>
      </div>
      <div class="qr-verified-box">
        <div style="font-size: 7.5pt; font-weight: 900; letter-spacing: 0.5px; color: #000;">OFFICIAL ERP</div>
        <div class="verified-pill">✓ VERIFIED</div>
      </div>
    </div>

    <!-- STAGE BANNER -->
    <div class="stage-banner">
      <div>
        <span class="badge-dot"></span>
        <span>STATUS: <strong>${card.status || 'Active'}</strong></span>
      </div>
      <div>${stageLabel}</div>
    </div>

    <!-- MAIN FIELDS TABLE -->
    <table>
      <tr>
        <td class="label">JOB NO. :</td><td class="val val-highlight">${jobNo}</td>
        <td class="label">COLORS :</td><td class="val">${card.colors || '—'}</td>
        <td class="label">DATE :</td><td class="val">${dateStr}</td>
      </tr>
      <tr>
        <td class="label">D. NO. :</td><td class="val val-highlight">${designNo}</td>
        <td class="label">PANNA :</td><td class="val">${card.panna || '—'}</td>
        <td class="label">PASS :</td><td class="val">${card.pass || '—'}</td>
      </tr>
      <tr>
        <td class="label">FABRIC :</td><td class="val">${card.fabric || '—'}</td>
        <td class="label">CON. :</td><td class="val">${card.consumption || '—'}</td>
        <td class="label">ALL OVER :</td><td class="val">${card.allover || '—'}</td>
      </tr>
      <tr>
        <td class="label">PCS :</td><td class="val">${card.pcs || '—'}</td>
        <td class="label">BOTTOM :</td><td class="val">${card.bottom || '—'}</td>
        <td class="label">PN/KM :</td><td class="val">${card.pnKm || '—'}</td>
      </tr>
      <tr>
        <td class="label">TOP :</td><td class="val">${card.top || '—'}</td>
        <td class="label">DUPATTA :</td><td class="val">${card.dupatta || '—'}</td>
        <td class="label">SET-COPY :</td><td class="val">${card.setCopy || '—'}</td>
      </tr>
      <tr>
        <td class="label">SLEEVE :</td><td class="val">${card.sleeve || '—'}</td>
        <td class="label">CUT :</td><td class="val">${card.cut || '—'}</td>
        <td colspan="2" class="total-header">TOTAL MTR</td>
      </tr>
      <tr>
        <td class="label">PARTY:</td>
        <td colspan="3" class="val val-highlight" style="font-size: 10pt;">${card.party || '—'}</td>
        <td colspan="2" class="total-val">: ${card.totalMtr || '—'}</td>
      </tr>
    </table>

    <!-- CENTRAL DESIGN PREVIEW HERO -->
    <div class="design-preview-container">
      ${(hasImg1 || hasImg2) ? `
        <button type="button" class="zoom-pill" onclick="openLightbox(0)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <span>Tap to Zoom</span>
        </button>
      ` : ''}

      <div class="artworks-flex">
        ${artworkHtml}
      </div>

      <div class="fonch-badge">
        <span class="fonch-arrow">→</span>
        <span class="fonch-text">FONCH</span>
      </div>
    </div>

    <!-- NOTES CONTAINER -->
    <div class="notes-container">
      <div class="note-row"><strong>NOTE 1 :</strong> ${card.note1 || ''}</div>
      <div class="note-row emrg-note"><strong>EMRG. NOTE :</strong> ${card.emergencyNotes || ''}</div>
      <div class="note-row"><strong>NOTE 2 :</strong> ${card.note2 || ''}</div>
    </div>

    <!-- TECHNICAL & PRE-PRESS -->
    <table class="tech-table">
      <tr>
        <td class="label" style="width: 15%;">DESIGNER :</td>
        <td class="val" style="width: 35%;">${card.designer || '—'}</td>
        <td class="label" style="width: 15%;">C. M.:</td>
        <td class="val" style="width: 35%;">${card.colourMatching || card.cm || '—'}</td>
      </tr>
      <tr>
        <td class="label">EXP. TIME :</td>
        <td class="val">${card.expTime || '—'}</td>
        <td class="label">PAPER TYPE :</td>
        <td class="val">${card.paperType || '—'}</td>
      </tr>
      <tr>
        <td class="label">OPERATER:</td>
        <td class="val">${card.operator || card.operatorName || '—'}</td>
        <td class="label">PRINT DATE :</td>
        <td class="val">${printDateStr}</td>
      </tr>
      <tr>
        <td class="label">ROLL NO. :</td>
        <td class="val">${card.rollNo || ''}</td>
        <td class="label">PRINT MTR :</td>
        <td class="val val-highlight">${card.printMtr || '—'}</td>
      </tr>
    </table>

    <!-- FUSING & FINISHING -->
    <table class="tech-table">
      <tr>
        <td class="label" style="width: 15%; text-align: center; font-weight: 800;">FUSING</td>
        <td class="label" style="width: 15%;">TEMP. :</td>
        <td class="val" style="width: 20%; text-align: center; font-weight: 800;">${card.temperature || card.fusingTemp || '235'}</td>
        <td class="label" style="width: 15%;">SPEED :</td>
        <td class="val" style="width: 35%; text-align: center; font-weight: 800;">${card.speed || '40'}</td>
      </tr>
      <tr>
        <td class="label" style="text-align: center; font-weight: 800;">NAME:</td>
        <td class="val" colspan="2">${card.fusingOperator || ''}</td>
        <td class="label">DATE :</td>
        <td class="val">${card.fusingDate || ''}</td>
      </tr>
    </table>

    <!-- T.P. METER TABLE -->
    <table class="tp-table">
      <tr>
        <th colspan="10" style="text-align: center; font-weight: 800; font-size: 8pt; background: #ffffff;">T.P. METER</th>
        <th colspan="2" style="font-size: 6.5pt; font-weight: 800; line-height: 1.1; padding: 2px; text-align: center; background: #ffffff;">T.P.<br/>WESTAGE<br/>METER</th>
      </tr>
      <tr>
        <td class="tp-label">1)</td><td class="tp-val"></td>
        <td class="tp-label">6)</td><td class="tp-val"></td>
        <td class="tp-label">11)</td><td class="tp-val"></td>
        <td class="tp-label">16)</td><td class="tp-val"></td>
        <td class="tp-label">20)</td><td class="tp-val"></td>
        <td class="tp-label" style="width: 24px;">1)</td><td class="tp-val"></td>
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

    <!-- ACTIONS -->
    <div class="actions-bar">
      ${(hasImg1 || hasImg2) ? `
        <button type="button" class="btn btn-primary" onclick="openLightbox(0)">
          🔍 Zoom Artwork
        </button>
      ` : ''}
      <a href="/v1/jobcards/pdf/${card._id}" class="btn btn-dark" download>
        ⬇ Download PDF
      </a>
      <button type="button" class="btn btn-outline" onclick="window.print()">
        🖨 Print Job Card
      </button>
    </div>
  </div>

  <!-- INTERACTIVE FULLSCREEN LIGHTBOX -->
  <div id="lightbox" class="lightbox-modal">
    <div class="lightbox-header">
      <div class="lightbox-title">
        <span id="lbTitle">Design Preview</span>
        <span class="lightbox-subtitle">${designNo} — Job #${jobNo}</span>
      </div>
      <div class="lightbox-controls">
        <button type="button" class="lb-btn" onclick="zoomIn()" title="Zoom In">+</button>
        <button type="button" class="lb-btn" onclick="zoomOut()" title="Zoom Out">−</button>
        <button type="button" class="lb-btn" onclick="resetZoom()" title="Reset">100%</button>
        <button type="button" class="lb-btn lb-close" onclick="closeLightbox()" title="Close">✕</button>
      </div>
    </div>
    <div class="lightbox-body" onclick="handleBodyClick(event)">
      <div class="lightbox-image-wrap" id="lbImgWrap">
        <img id="lbImg" src="" alt="Zoomed Design" />
      </div>
    </div>
    <div class="lightbox-footer">
      <span id="lbCounter" style="display:none;">Artwork 1 of 2</span>
      <button type="button" class="lb-nav-btn" id="lbPrevBtn" onclick="prevArtwork()" style="display:none;">◀ Prev</button>
      <button type="button" class="lb-nav-btn" id="lbNextBtn" onclick="nextArtwork()" style="display:none;">Next ▶</button>
      <span>Pinch or click buttons to zoom</span>
    </div>
  </div>

  <script nonce="${nonce}">
    var imagesList = [
      ${primaryImg1 ? `'${primaryImg1}'` : ''}${primaryImg1 && primaryImg2 ? ',' : ''}${primaryImg2 ? `'${primaryImg2}'` : ''}
    ];
    var currentImgIdx = 0;
    var currentZoom = 1;

    function handleImgError(img) {
      try {
        var raw = img.getAttribute('data-candidates');
        if (!raw) return;
        var list = JSON.parse(raw);
        var idx = parseInt(img.getAttribute('data-idx') || '0', 10) + 1;
        if (idx < list.length) {
          img.setAttribute('data-idx', idx);
          img.src = list[idx];
          // Update imagesList as well
          var elId = img.id;
          if (elId === 'designImg0') imagesList[0] = list[idx];
          if (elId === 'designImg1') imagesList[1] = list[idx];
        }
      } catch (err) {
        console.warn('Candidate error:', err);
      }
    }

    function openLightbox(idx) {
      if (!imagesList.length) return;
      currentImgIdx = (idx >= 0 && idx < imagesList.length) ? idx : 0;
      currentZoom = 1;
      updateLightboxDisplay();
      document.getElementById('lightbox').style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('lightbox').style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    function updateLightboxDisplay() {
      var lbImg = document.getElementById('lbImg');
      var lbWrap = document.getElementById('lbImgWrap');
      var lbCounter = document.getElementById('lbCounter');
      var prevBtn = document.getElementById('lbPrevBtn');
      var nextBtn = document.getElementById('lbNextBtn');
      var lbTitle = document.getElementById('lbTitle');

      lbImg.src = imagesList[currentImgIdx] || '';
      lbWrap.style.transform = 'scale(1)';
      currentZoom = 1;

      if (imagesList.length > 1) {
        lbCounter.style.display = 'inline-block';
        lbCounter.innerText = 'Artwork ' + (currentImgIdx + 1) + ' of ' + imagesList.length;
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        lbTitle.innerText = currentImgIdx === 0 ? 'Artwork 1 (Top)' : 'Artwork 2 (Dupatta)';
      } else {
        lbCounter.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        lbTitle.innerText = 'Design Artwork';
      }
    }

    function zoomIn() {
      currentZoom = Math.min(currentZoom + 0.35, 3.5);
      document.getElementById('lbImgWrap').style.transform = 'scale(' + currentZoom + ')';
    }

    function zoomOut() {
      currentZoom = Math.max(currentZoom - 0.35, 0.7);
      document.getElementById('lbImgWrap').style.transform = 'scale(' + currentZoom + ')';
    }

    function resetZoom() {
      currentZoom = 1;
      document.getElementById('lbImgWrap').style.transform = 'scale(1)';
    }

    function prevArtwork() {
      if (imagesList.length <= 1) return;
      currentImgIdx = (currentImgIdx - 1 + imagesList.length) % imagesList.length;
      updateLightboxDisplay();
    }

    function nextArtwork() {
      if (imagesList.length <= 1) return;
      currentImgIdx = (currentImgIdx + 1) % imagesList.length;
      updateLightboxDisplay();
    }

    function handleBodyClick(e) {
      if (e.target && e.target.id === 'lbImg') {
        // Toggle zoom on image click
        if (currentZoom === 1) {
          zoomIn();
        } else {
          resetZoom();
        }
      } else if (e.target && e.target.classList && e.target.classList.contains('lightbox-body')) {
        closeLightbox();
      }
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextArtwork();
      if (e.key === 'ArrowLeft') prevArtwork();
    });
  </script>
</body>
</html>`;
}

/**
 * 404 HTML Template when Job Card is not found
 */
function renderInvalidJobCardHtml(param) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Card Not Found — Elite Digital Prints</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 440px; width: 100%; padding: 32px 24px; text-align: center; }
    .badge { display: inline-block; background: #ef4444; color: #fff; padding: 4px 12px; border-radius: 9999px; font-weight: 800; font-size: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #ffffff; }
    p { color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin-bottom: 20px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">NOT FOUND</div>
    <h1>Job Card Not Found</h1>
    <p>Could not locate any active Job Card with identifier <strong>"${param}"</strong> in Elite Digital Prints ERP database.</p>
    <a href="https://erp.eliteedition.in" class="btn">Return to ERP Home</a>
  </div>
</body>
</html>`;
}

module.exports = {
  verifyJobCard
};
