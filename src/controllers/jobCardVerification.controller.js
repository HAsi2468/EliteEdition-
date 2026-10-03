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

  // 1. Google Drive Links
  if (raw.includes('drive.google.com') || raw.includes('googleusercontent') || raw.includes('lh3.google')) {
    let fid = '';
    const m1 = raw.match(/\/d\/([-\w]{20,})/);
    if (m1) fid = m1[1];
    if (!fid) {
      const m2 = raw.match(/[?&]id=([-\w]{20,})/);
      if (m2) fid = m2[1];
    }
    if (!fid) {
      const m3 = raw.match(/([-\w]{25,})/);
      if (m3) fid = m3[1];
    }
    if (fid) {
      return [`https://lh3.googleusercontent.com/d/${fid}=s1600`];
    }
  }

  // 2. Direct absolute HTTP/HTTPS URL
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    add(raw);
  }

  // Extract clean filename
  let rawFilename = raw;
  if (raw.includes('/designs/')) {
    rawFilename = raw.split('/designs/')[1];
  } else if (raw.includes('/design_samples/')) {
    rawFilename = 'design_samples/' + raw.split('/design_samples/')[1];
  } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
    rawFilename = raw.split('/').pop() || '';
  }
  rawFilename = rawFilename.split('?')[0].split('#')[0];
  try { rawFilename = decodeURIComponent(rawFilename); } catch (e) {}

  const cleanDesign = dName.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '').trim();

  if (rawFilename) {
    if (rawFilename.startsWith('design_samples/')) {
      add(`${R2_BASE}/${rawFilename}`);
    } else {
      add(`${R2_BASE}/designs/${encodeURIComponent(rawFilename)}`);
      add(`https://erp.eliteedition.in/v1/designs/${encodeURIComponent(rawFilename)}`);
      add(`/v1/designs/${encodeURIComponent(rawFilename)}`);
    }

    const baseWithoutExt = rawFilename.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '');
    if (baseWithoutExt && !rawFilename.startsWith('blob-') && !rawFilename.startsWith('image-')) {
      add(`${R2_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
      add(`${R2_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpeg`);
      add(`${R2_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.png`);
      add(`${R2_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.webp`);
      add(`/v1/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
    }
  }

  if (cleanDesign) {
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`https://erp.eliteedition.in/v1/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`/v1/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpeg`);
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.png`);
    add(`${R2_BASE}/designs/${encodeURIComponent(cleanDesign)}.webp`);

    // Suffix stripping (e.g. 'ED-523 D' -> 'ED-523', 'ED-435(1)' -> 'ED-435')
    const s1 = cleanDesign.replace(/\s+[A-Za-z0-9]$/, '').trim();
    const s2 = cleanDesign.replace(/\s*\([0-9]+\)$/, '').trim();
    const s3 = cleanDesign.replace(/jpe?g$/i, '').trim();
    for (const s of [s1, s2, s3]) {
      if (s && s !== cleanDesign) {
        add(`${R2_BASE}/designs/${encodeURIComponent(s)}.jpg`);
        add(`https://erp.eliteedition.in/v1/designs/${encodeURIComponent(s)}.jpg`);
        add(`/v1/designs/${encodeURIComponent(s)}.jpg`);
        add(`${R2_BASE}/designs/${encodeURIComponent(s)}.jpeg`);
        add(`${R2_BASE}/designs/${encodeURIComponent(s)}.png`);
      }
    }
  }

  // Fallback badge URL (server-generated SVG or placeholder) so it NEVER breaks
  const fallbackToken = cleanDesign || rawFilename || 'DESIGN';
  add(`/v1/designs/${encodeURIComponent(fallbackToken)}.jpg?fallback=1`);

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

    let raw1 = card.imageUrl1 || card.imageUrl || card.proofing?.artworkUrl || '';
    let raw2 = card.imageUrl2 || '';
    const designNo = card.designNo || card.designName || '';
    const hasMultipleDesigns = designNo.includes(',') || (card.designName && card.designName.includes(','));
    const showTwoImages = Boolean(raw2 && raw2.trim()) || (hasMultipleDesigns && Boolean(card.designName));

    // Fallback: If raw1 is empty, check Design DB collection for design image
    if (!raw1 && designNo && db.Design) {
      try {
        const cleanD = designNo.trim().replace(/^ED-/i, '');
        const dDoc = await db.Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${cleanD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${cleanD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          ]
        }).lean();
        if (dDoc) {
          raw1 = dDoc.imageUrl || dDoc.imageUrl1 || '';
          if (!raw2 && dDoc.imageUrl2) raw2 = dDoc.imageUrl2;
        }
      } catch (e) {}
    }

    const candidates1 = getDesignCandidates(raw1, designNo);
    const candidates2 = showTwoImages
      ? getDesignCandidates(raw2, hasMultipleDesigns ? designNo.split(',')[1].trim() : '')
      : [];

    // Fetch linked Fabric Challans for this Job Card to populate TP meters
    let challans = [];
    if (db.FabricChallan && card.jobNo) {
      const cleanNo = String(card.jobNo).replace(/^#?JOB\s*NO\.?\s*[-:]?\s*/i, '').replace(/^JC-/i, '').trim();
      const digits = cleanNo.match(/\d+/)?.[0];
      const or = [
        { jobNo: String(card.jobNo).trim() },
        { jobNo: new RegExp('\\b' + cleanNo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '\\b', 'i') }
      ];
      if (digits) {
        or.push({ jobNo: new RegExp('\\b' + digits + '\\b', 'i') });
        or.push({ jobNo: `JOB-${digits}` });
        or.push({ jobNo: `JOB NO.- ${digits}` });
      }
      challans = await db.FabricChallan.find({ $or: or }).sort({ challanNo: 1 }).lean();
    }

    const nonce = res.locals.cspNonce || '';

    if (req.accepts('html')) {
      return res.status(200).send(renderValidJobCardHtml(card, { candidates1, candidates2, challans, nonce }));
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
 * /**
 * Builds the 5-column TP Meter & Wastage Meter grid from linked Fabric Challans and Job Card faults.
 * Slots:
 * Row 1: 1), 6), 11), 16), 20) | 1)
 * Row 2: 2), 7), 12), 17), 21) | 2)
 * Row 3: 3), 8), 13), 18), 22) | 3)
 * Row 4: 4), 9), 14), 19), 23) | 
 * Row 5: 5), 10), 15), TOTAL :- | TOT:
 */
function buildTpAndWasteGrid(challans = [], card = {}) {
  const chList = Array.isArray(challans) ? challans : [];
  const allTpMtrs = [];
  const allWestMtrs = [];

  for (const ch of chList) {
    const details = Array.isArray(ch.tpDetails) ? ch.tpDetails : [];
    for (const tp of details) {
      const mtr = parseFloat(tp.tpMeter);
      if (!isNaN(mtr) && mtr > 0) {
        allTpMtrs.push(String(Number(mtr.toFixed(2))));
      }
      const w = parseFloat(tp.westMtr);
      if (!isNaN(w) && w > 0) {
        allWestMtrs.push(String(Number(w.toFixed(2))));
      }
    }
  }

  // Column capacities: Col 0: 5, Col 1: 5, Col 2: 5, Col 3: 4, Col 4: 4 (Total 23 TP slots)
  const colCapacities = [5, 5, 5, 4, 4];
  const colLabels = [
    ['1)', '2)', '3)', '4)', '5)'],
    ['6)', '7)', '8)', '9)', '10)'],
    ['11)', '12)', '13)', '14)', '15)'],
    ['16)', '17)', '18)', '19)'],
    ['20)', '21)', '22)', '23)']
  ];

  const cols = [[], [], [], [], []];
  let ptr = 0;
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < colCapacities[c]; r++) {
      cols[c].push(ptr < allTpMtrs.length ? allTpMtrs[ptr++] : '');
    }
  }

  // Wastage items (roll-wise westMtr first, then faults from job card)
  const wItems = [...allWestMtrs];
  const ff = parseFloat(card.fabricFaultMtr) || 0;
  const pf = parseFloat(card.printFaultMtr) || 0;
  const fs = parseFloat(card.fusingFaultMtr) || 0;
  const gf = parseFloat(card.genuineFaultMtr) || 0;
  let cw = 0;
  chList.forEach(ch => {
    cw += (parseFloat(ch.proportionalWasteMtr) || 0);
  });

  if (ff > 0) wItems.push(`FF:${ff}`);
  if (pf > 0) wItems.push(`PF:${pf}`);
  if (fs > 0) wItems.push(`FS:${fs}`);
  if (gf > 0) wItems.push(`GF:${gf}`);
  if (cw > 0) wItems.push(`CW:${Number(cw.toFixed(2))}`);

  const totalW = parseFloat(card.totalWastageMtr) || (
    allWestMtrs.reduce((s, w) => s + parseFloat(w), 0) + ff + pf + fs + gf + cw
  );

  const wSlots = [
    wItems[0] || '',
    wItems[1] || '',
    wItems[2] || '',
    wItems[3] || ''
  ];
  const wTotalLbl = totalW > 0 ? 'TOT:' : '';
  const wTotalVal = totalW > 0 ? String(Number(totalW.toFixed(2))) : (wItems[4] || '');

  const sumMtr = allTpMtrs.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
  const finalTotalMtr = sumMtr > 0
    ? String(Number(sumMtr.toFixed(2)))
    : (card.printMtr || card.totalMtr || '');

  function makeCell(lbl, val, isHeader = false) {
    const arr = [lbl, val, isHeader];
    arr.lbl = lbl;
    arr.val = val;
    arr.isHeader = isHeader;
    return arr;
  }

  function makeWCell(wLbl, wVal) {
    const arr = [wLbl, wVal, false];
    arr.wLbl = wLbl;
    arr.wVal = wVal;
    return arr;
  }

  // 5 rows of grid (each row has 6 cells: 5 TP columns + 1 Wastage column)
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      if (r === 4 && c === 3) {
        row.push(makeCell('TOTAL :-', ''));
      } else if (r === 4 && c === 4) {
        row.push(makeCell('', finalTotalMtr));
      } else {
        row.push(makeCell(colLabels[c][r], cols[c][r]));
      }
    }
    const wLbl = r === 4 ? wTotalLbl : (r < 3 ? `${r + 1})` : '');
    const wVal = r === 4 ? wTotalVal : wSlots[r];
    row.push(makeWCell(wLbl, wVal));
    rows.push(row);
  }

  const challanDetailsList = chList.map(c => {
    const cNo = c.challanNo ? `EDP-${c.challanNo}` : 'Challan';
    const cleanNo = c.challanNo ? String(c.challanNo).replace(/^EDP-?/i, '') : '';
    const challanLink = cleanNo
      ? `<a href="/verify/challan/${cleanNo}" target="_blank" style="color: #0b5394; text-decoration: underline; font-weight: 700;">${cNo}</a>`
      : cNo;
    let mtr = parseFloat(c.totalMtr) || 0;
    if (!mtr && Array.isArray(c.tpDetails)) {
      mtr = c.tpDetails.reduce((acc, t) => acc + (parseFloat(t.tpMeter) || 0), 0);
    }
    const mtrStr = mtr > 0 ? `${Number(mtr.toFixed(2))} Mtr` : '';
    let invStr = '';
    if (c.invoiceNo) {
      const encInv = encodeURIComponent(c.invoiceNo);
      invStr = `Inv: <a href="/verify/invoice/${encInv}" target="_blank" style="color: #0b5394; text-decoration: underline; font-weight: 700;">${c.invoiceNo}</a>`;
    } else {
      invStr = 'Inv: --';
    }
    const parts = [mtrStr, invStr].filter(Boolean).join(', ');
    return parts ? `${challanLink} (${parts})` : challanLink;
  });
  const challanNosStr = challanDetailsList.join(', ');

  return { rows, totalMtr: finalTotalMtr, challanNosStr, challanSummaryStr: challanNosStr, totalW: totalW > 0 ? Number(totalW.toFixed(2)) : 0 };
}

function getFabricFusingPreset(fabricName) {
  const f = String(fabricName || '').toLowerCase();
  if (f.includes('crepe') || f.includes('french')) {
    return { temp: '210°C', speed: '80' };
  }
  if (f.includes('organza')) {
    return { temp: '195°C', speed: '80' };
  }
  if (f.includes('satin')) {
    return { temp: '205°C', speed: '80' };
  }
  if (f.includes('georgette') || f.includes('chiffon')) {
    return { temp: '200°C', speed: '80' };
  }
  if (f.includes('modal') || f.includes('rayon')) {
    return { temp: '190°C', speed: '80' };
  }
  if (f.includes('velvet') || f.includes('heavy')) {
    return { temp: '205°C', speed: '80' };
  }
  return { temp: '205°C', speed: '80' };
}

/**
 * HTML Template for Valid Job Card with authentic Job Card Layout & High-Res Zoomable Design Preview
 */
function renderValidJobCardHtml(card, options = {}) {
  const { candidates1 = [], candidates2 = [], challans = [], nonce = '' } = options;
  const { rows: tpRows, totalMtr: finalTpTotal, challanNosStr, totalW = 0 } = buildTpAndWasteGrid(challans, card);
  const jobNo = card.jobNo || '—';
  const designNo = card.designNo || card.designName || '—';
  const machine = (card.machineName || 'PRINTDOT').toUpperCase();
  const machineBg = machine === 'GRANDO' ? '#0b5394' : '#cc0000';

  const preset = getFabricFusingPreset(card.fabric);
  const fusingTemp = card.fusingTemp || card.temperature || preset.temp || '—';
  const fusingSpeed = card.fusingSpeed || card.speed || preset.speed || '—';

  const freshNum = parseFloat(card.freshMtr) || parseFloat(finalTpTotal) || parseFloat(card.totalMtr) || 0;
  const wasteNum = totalW > 0 ? totalW : (parseFloat(card.totalWastageMtr) || 0);
  let recoveryHtml = '';
  if (freshNum > 0) {
    const totalUsed = freshNum + wasteNum;
    const yieldPct = ((freshNum / totalUsed) * 100).toFixed(1);
    recoveryHtml = `<div>📊 <strong>Fresh Recovery:</strong> <span style="color: #166534; font-weight: 800;">${yieldPct}%</span>`;
    if (card.shrinkagePct) {
      recoveryHtml += ` | <strong>Avg Shrinkage:</strong> ${card.shrinkagePct}%`;
    }
    recoveryHtml += `</div>`;
  }

  const pannaDisplay = card.panna
    ? (card.rawPanna ? `${card.panna} (Raw: ${card.rawPanna})` : card.panna)
    : (card.rawPanna || '—');
  const fabricDisplay = `${card.fabric || '—'}${card.fabricSource ? ` <span style="font-size: 7.5pt; color: #475569; font-weight: 700;">[${card.fabricSource}]</span>` : ''}`;

  const dateStr = card.date
    ? (card.date.includes('-') ? card.date.split('-').reverse().join('/') : card.date)
    : '—';
  const printDateStr = card.printDate
    ? (card.printDate.includes('-') ? card.printDate.split('-').reverse().join('/') : card.printDate)
    : '—';

  const hasImg1 = candidates1.length > 0;
  const hasImg2 = candidates2.length > 0;
  const primaryImg1 = candidates1[0] || card.imageUrl1 || '';
  const primaryImg2 = candidates2[0] || card.imageUrl2 || '';

  const c1Json = JSON.stringify(candidates1).replace(/"/g, '&quot;');
  const c2Json = JSON.stringify(candidates2).replace(/"/g, '&quot;');

  let artworkHtml = '';
  if (hasImg1 && hasImg2) {
    artworkHtml = `
      <div class="artwork-item" data-img-idx="0" onclick="openLightbox(0)" title="Click to view full image">
        <img class="artwork-img" id="designImg0" src="${primaryImg1}" data-candidates="${c1Json}" data-idx="0" alt="${designNo} - 1" referrerpolicy="no-referrer" onerror="handleImgError(this)" />
      </div>
      <div class="artwork-item" data-img-idx="1" onclick="openLightbox(1)" title="Click to view full image">
        <img class="artwork-img" id="designImg1" src="${primaryImg2}" data-candidates="${c2Json}" data-idx="0" alt="${designNo} - 2" referrerpolicy="no-referrer" onerror="handleImgError(this)" />
      </div>
    `;
  } else if (hasImg1) {
    artworkHtml = `
      <div class="artwork-item" data-img-idx="0" onclick="openLightbox(0)" title="Click to view full image">
        <img class="artwork-img" id="designImg0" src="${primaryImg1}" data-candidates="${c1Json}" data-idx="0" alt="${designNo}" referrerpolicy="no-referrer" onerror="handleImgError(this)" />
      </div>
    `;
  } else if (hasImg2) {
    artworkHtml = `
      <div class="artwork-item" data-img-idx="0" onclick="openLightbox(0)" title="Click to view full image">
        <img class="artwork-img" id="designImg0" src="${primaryImg2}" data-candidates="${c2Json}" data-idx="0" alt="${designNo}" referrerpolicy="no-referrer" onerror="handleImgError(this)" />
      </div>
    `;
  } else {
    artworkHtml = `
      <div class="no-design-box">
        <div style="font-weight: 800; font-size: 10pt; color: #94a3b8;">NO DESIGN IMAGE</div>
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
    @page { size: A5 portrait; margin: 6mm; }
    @media print {
      body { background-color: #ffffff; padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card-container { max-width: 100%; border: 1.5px solid #000000; box-shadow: none; margin: 0 auto; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #000000; padding: 10px; display: flex; justify-content: center; }
    .card-container { max-width: 580px; width: 100%; background: #ffffff; border: 1.5px solid #000000; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; margin: 0 auto; }
    
    /* Header */
    .header-bar { display: flex; align-items: stretch; justify-content: space-between; border-bottom: 1.5px solid #000; background: #ffffff; }
    .logo-box { width: 110px; padding: 6px 8px; display: flex; align-items: center; justify-content: center; border-right: 1.5px solid #000; }
    .logo-box img { max-height: 42px; width: 100%; object-fit: contain; }
    .header-center { flex: 1; text-align: center; padding: 4px 6px; display: flex; flex-direction: column; justify-content: center; }
    .company-title { font-size: 14pt; font-weight: 900; letter-spacing: 0.5px; color: #000; text-transform: uppercase; }
    .machine-badge { display: inline-block; background: ${machineBg}; color: #ffffff; font-size: 9pt; font-weight: 800; padding: 2px 20px; border-radius: 2px; margin: 2px auto 0; letter-spacing: 1px; }
    .qr-verified-box { width: 110px; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1.5px solid #000; background: #f8fafc; text-align: center; }
    .verified-pill { font-size: 7.5pt; font-weight: 800; color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 2px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-top: 1px; }
    td, th { border: 1.2px solid #000000; padding: 3px 5px; font-size: 9pt; vertical-align: middle; line-height: 1.25; }
    .label { font-weight: 800; background: #ffffff; width: 1%; white-space: nowrap; font-size: 8.5pt; text-align: left; }
    .val { font-weight: 500; font-size: 9pt; }
    .total-header { text-align: center; font-weight: 800; font-size: 9pt; background: #ffffff; }
    .total-val { font-weight: 900; font-size: 11.5pt; padding-left: 8px; }

    /* DESIGN IMAGE BOX */
    .jobcard-img-box {
      display: flex;
      width: 100%;
      border: 1.2px solid #000000;
      border-top: none;
      min-height: 180px;
      max-height: 320px;
      margin-top: 0;
      background: #ffffff;
      overflow: hidden;
    }
    .artwork-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 6px;
      cursor: zoom-in;
      background: #ffffff;
    }
    .artwork-item + .artwork-item {
      border-left: 1.2px solid #000000;
    }
    .artwork-img {
      max-width: 100%;
      max-height: 305px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .no-design-box {
      display: flex;
      width: 100%;
      min-height: 140px;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

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

    /* T.P. Meter Table */
    .tp-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .tp-table td { text-align: center; padding: 2px 4px; font-size: 8.5pt; border: 1.2px solid #000; height: 26px; }
    .tp-table th { font-size: 9pt; font-weight: 800; border: 1.2px solid #000; background: #fff; padding: 3px; }
    .tp-label { font-weight: 700; width: 1%; white-space: nowrap; font-size: 7.5pt; background: #ffffff; text-align: center; }
    .tp-val { width: 14%; font-size: 8pt; font-weight: 700; text-align: center; color: #000000; }
    .tp-waste-val { font-weight: 800; color: #b91c1c; font-size: 7.2pt; text-align: center; }

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
    .lb-close-icon {
      cursor: pointer;
      font-size: 24px;
      font-weight: 800;
      color: #ef4444;
      padding: 0 10px;
      line-height: 1;
      transition: transform 0.15s ease;
    }
    .lb-close-icon:hover {
      transform: scale(1.15);
      color: #f87171;
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
      transition: transform 0.18s cubic-bezier(0.2, 0, 1);
      transform-origin: center center;
    }
    #lbImg {
      max-width: 92vw;
      max-height: 85vh;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      display: block;
      margin: 0 auto;
    }

    @media (max-width: 480px) {
      body { padding: 4px; }
      td, th { padding: 3px 4px; font-size: 8pt; }
      .label { font-size: 7.2pt; width: 18%; }
      .company-title { font-size: 12pt; }
      .jobcard-img-box { min-height: 180px; max-height: 320px; }
      .artwork-img { max-height: 280px; }
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

    <!-- MAIN FIELDS TABLE -->
    <table>
      <tr>
        <td class="label">JOB NO. :</td><td class="val val-highlight">${jobNo}</td>
        <td class="label">COLORS :</td><td class="val">${card.colors || '—'}</td>
        <td class="label">DATE :</td><td class="val">${dateStr}</td>
      </tr>
      <tr>
        <td class="label">D. NO. :</td><td class="val val-highlight">${designNo}</td>
        <td class="label">PANNA :</td><td class="val">${pannaDisplay}</td>
        <td class="label">PASS :</td><td class="val">${card.pass || '—'}</td>
      </tr>
      <tr>
        <td class="label">FABRIC :</td><td class="val">${fabricDisplay}</td>
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
      <!-- CLIENT ORDER & TRACKING ROW -->
      <tr>
        <td class="label">CLIENT PO :</td><td class="val" style="font-weight: 700; color: #0b5394;">${card.clientPoNo || card.poNo || '—'}</td>
        <td class="label">LOT NO. :</td><td class="val" style="font-weight: 700;">${card.lotNo || '—'}</td>
        <td class="label">TARGET :</td><td class="val" style="font-weight: 700; color: #166534;">${card.targetDeliveryDate || '—'}</td>
      </tr>
    </table>

    <!-- CENTRAL DESIGN PREVIEW -->
    <div class="jobcard-img-box">
      ${artworkHtml}
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
        <td class="val" style="width: 20%; text-align: center; font-weight: 800;">${fusingTemp}</td>
        <td class="label" style="width: 15%;">SPEED :</td>
        <td class="val" style="width: 35%; text-align: center; font-weight: 800;">${fusingSpeed}</td>
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
      <thead>
        <tr>
          <th colspan="10" style="text-align: center; font-weight: 800; font-size: 8pt; background: #ffffff;">T.P. METER</th>
          <th colspan="2" style="font-size: 6.5pt; font-weight: 800; line-height: 1.1; padding: 2px; text-align: center; background: #ffffff;">T.P.<br/>WESTAGE<br/>METER</th>
        </tr>
      </thead>
      <tbody>
        <!-- Row 1 -->
        <tr>
          <td class="tp-label">1)</td><td class="tp-val">${tpRows[0][0].val}</td>
          <td class="tp-label">6)</td><td class="tp-val">${tpRows[0][1].val}</td>
          <td class="tp-label">11)</td><td class="tp-val">${tpRows[0][2].val}</td>
          <td class="tp-label">16)</td><td class="tp-val">${tpRows[0][3].val}</td>
          <td class="tp-label">20)</td><td class="tp-val">${tpRows[0][4].val}</td>
          <td class="tp-label" style="width: 24px; background: #fff1f2;">1)</td><td class="tp-val tp-waste-val">${tpRows[0][5].wVal}</td>
        </tr>
        <!-- Row 2 -->
        <tr>
          <td class="tp-label">2)</td><td class="tp-val">${tpRows[1][0].val}</td>
          <td class="tp-label">7)</td><td class="tp-val">${tpRows[1][1].val}</td>
          <td class="tp-label">12)</td><td class="tp-val">${tpRows[1][2].val}</td>
          <td class="tp-label">17)</td><td class="tp-val">${tpRows[1][3].val}</td>
          <td class="tp-label">21)</td><td class="tp-val">${tpRows[1][4].val}</td>
          <td class="tp-label" style="background: #fff1f2;">2)</td><td class="tp-val tp-waste-val">${tpRows[1][5].wVal}</td>
        </tr>
        <!-- Row 3 -->
        <tr>
          <td class="tp-label">3)</td><td class="tp-val">${tpRows[2][0].val}</td>
          <td class="tp-label">8)</td><td class="tp-val">${tpRows[2][1].val}</td>
          <td class="tp-label">13)</td><td class="tp-val">${tpRows[2][2].val}</td>
          <td class="tp-label">18)</td><td class="tp-val">${tpRows[2][3].val}</td>
          <td class="tp-label">22)</td><td class="tp-val">${tpRows[2][4].val}</td>
          <td class="tp-label" style="background: #fff1f2;">3)</td><td class="tp-val tp-waste-val">${tpRows[2][5].wVal}</td>
        </tr>
        <!-- Row 4 -->
        <tr>
          <td class="tp-label">4)</td><td class="tp-val">${tpRows[3][0].val}</td>
          <td class="tp-label">9)</td><td class="tp-val">${tpRows[3][1].val}</td>
          <td class="tp-label">14)</td><td class="tp-val">${tpRows[3][2].val}</td>
          <td class="tp-label">19)</td><td class="tp-val">${tpRows[3][3].val}</td>
          <td class="tp-label">23)</td><td class="tp-val">${tpRows[3][4].val}</td>
          <td class="tp-label" style="background: #f8fafc;">${tpRows[3][5].wLbl}</td><td class="tp-val tp-waste-val">${tpRows[3][5].wVal}</td>
        </tr>
        <!-- Row 5 -->
        <tr>
          <td class="tp-label">5)</td><td class="tp-val">${tpRows[4][0].val}</td>
          <td class="tp-label">10)</td><td class="tp-val">${tpRows[4][1].val}</td>
          <td class="tp-label">15)</td><td class="tp-val">${tpRows[4][2].val}</td>
          <td colspan="3" style="font-weight: 800; font-size: 7.2pt; text-align: right; padding-right: 5px; background: #f8fafc;">TOTAL :-</td>
          <td class="tp-val" style="font-weight: 900; color: #1e3a8a;">${finalTpTotal}</td>
          <td class="tp-label" style="background: #fef2f2; font-weight: 800; font-size: 6.5pt;">${(tpRows[4][5] || tpRows[4][3]).wLbl}</td>
          <td class="tp-val tp-waste-val" style="font-weight: 900;">${(tpRows[4][5] || tpRows[4][3]).wVal}</td>
        </tr>
      </tbody>
    </table>

    <!-- LEGEND / DETAILS FOR SHORT FORMS -->
    <div style="padding: 3px 6px; border: 1.2px solid #000; border-top: none; font-size: 6.5pt; color: #334155; background: #ffffff; display: flex; flex-direction: column; gap: 2px; line-height: 1.3;">
      ${recoveryHtml}
      ${challanNosStr ? `<div><strong>Challan:</strong> ${challanNosStr}</div>` : ''}
      <div><strong>*Wastage:</strong> <strong>FF</strong>: Fabric Fault | <strong>PF</strong>: Print Fault | <strong>FS</strong>: Fusing Fault | <strong>GF</strong>: Genuine Fault | <strong>CW</strong>: Challan Waste | <strong>TOT</strong>: Total Wastage</div>
    </div>
  </div>

  <!-- INTERACTIVE FULLSCREEN LIGHTBOX (No buttons) -->
  <div id="lightbox" class="lightbox-modal" onclick="handleBodyClick(event)">
    <div class="lightbox-header">
      <div class="lightbox-title">
        <span id="lbTitle">${designNo}</span>
        <span class="lightbox-subtitle">Job #${jobNo}</span>
      </div>
      <div class="lightbox-controls">
        <span class="lb-close-icon" onclick="closeLightbox()" title="Close">&times;</span>
      </div>
    </div>
    <div class="lightbox-body">
      <div class="lightbox-image-wrap" id="lbImgWrap">
        <img id="lbImg" src="" alt="Zoomed Design" referrerpolicy="no-referrer" />
      </div>
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
      var lbTitle = document.getElementById('lbTitle');

      if (lbImg) lbImg.src = imagesList[currentImgIdx] || '';
      if (lbWrap) lbWrap.style.transform = 'scale(1)';
      currentZoom = 1;

      if (lbTitle) {
        if (imagesList.length > 1) {
          lbTitle.innerText = currentImgIdx === 0 ? 'Artwork 1 (Top)' : 'Artwork 2 (Dupatta)';
        } else {
          lbTitle.innerText = 'Design Artwork';
        }
      }
    }

    function zoomIn() {
      currentZoom = Math.min(currentZoom + 0.35, 3.5);
      var wrap = document.getElementById('lbImgWrap');
      if (wrap) wrap.style.transform = 'scale(' + currentZoom + ')';
    }

    function resetZoom() {
      currentZoom = 1;
      var wrap = document.getElementById('lbImgWrap');
      if (wrap) wrap.style.transform = 'scale(1)';
    }

    function handleBodyClick(e) {
      if (e.target && e.target.id === 'lbImg') {
        if (currentZoom === 1) {
          zoomIn();
        } else {
          resetZoom();
        }
      } else if (e.target && (e.target.id === 'lightbox' || (e.target.classList && e.target.classList.contains('lightbox-body')))) {
        closeLightbox();
      }
    }

    document.querySelectorAll('.artwork-img').forEach(function(img) {
      img.addEventListener('error', function() {
        handleImgError(img);
      });
    });
    document.querySelectorAll('.artwork-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-img-idx') || '0', 10);
        openLightbox(idx);
      });
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;
}

/**
 * 404 HTML Template when Job Card is not found (No buttons)
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
    p { color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">NOT FOUND</div>
    <h1>Job Card Not Found</h1>
    <p>Could not locate any active Job Card with identifier <strong>"${param}"</strong> in Elite Digital Prints ERP database.</p>
  </div>
</body>
</html>`;
}

module.exports = {
  verifyJobCard
};
