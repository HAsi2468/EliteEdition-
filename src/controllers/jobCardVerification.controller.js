/**
 * Controller: Digital QR Code Physical Job Card Verification & Public Viewer
 *
 * Provides instant public verification and mobile-friendly full view of Job Cards
 * when scanning the physical QR code on printed Job Cards.
 */

const mongoose = require('mongoose');
const db = require('../db/models');
const { normalizeImageUrl } = require('../utils/imageUrlHelper');

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

    card.imageUrl1 = normalizeImageUrl(card.imageUrl1 || card.imageUrl, card.designName || card.designNo);
    card.imageUrl2 = normalizeImageUrl(card.imageUrl2, card.designName ? `${card.designName}-2` : '');

    if (req.accepts('html')) {
      return res.status(200).send(renderValidJobCardHtml(card));
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
 * HTML Template for Valid Job Card
 */
function renderValidJobCardHtml(card) {
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
  let stageColor = '#f59e0b';
  let stageBg = '#fffbeb';
  let stageBorder = '#fde68a';

  if (isDispatched) {
    stageLabel = `4. Dispatched (${deliveredMtr}m)`;
    stageColor = '#10b981';
    stageBg = '#ecfdf5';
    stageBorder = '#a7f3d0';
  } else if (isFusingDone || fusedMtr > 0) {
    stageLabel = `3. Ready for Challan (${fusedMtr}m Fused)`;
    stageColor = '#2563eb';
    stageBg = '#eff6ff';
    stageBorder = '#bfdbfe';
  } else if (isPrintDone) {
    stageLabel = '2. Fusing Pending';
    stageColor = '#d97706';
    stageBg = '#fef3c7';
    stageBorder = '#fde68a';
  }

  const imagesHtml = [card.imageUrl1, card.imageUrl2].filter(Boolean).map((img, i) => `
    <div style="flex: 1; min-width: 140px; max-width: 100%; border: 1.2px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f8fafc; text-align: center; padding: 6px;">
      <a href="${img}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="Design Preview ${i + 1}" style="max-height: 200px; width: auto; max-width: 100%; object-fit: contain; border-radius: 4px;" />
      </a>
      <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-top: 4px;">Tap image to view high-res</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Card #${jobNo} — Elite Digital Prints</title>
  <link rel="icon" type="image/png" href="/DigitalLogo.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #0f172a; padding: 12px; display: flex; justify-content: center; }
    .card-container { max-width: 650px; width: 100%; background: #ffffff; border: 1.5px solid #000000; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
    
    /* Top Header */
    .header-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1.5px solid #000; background: #fafafa; }
    .header-logo { height: 34px; object-fit: contain; }
    .header-center { text-align: center; flex: 1; }
    .company-title { font-size: 14pt; font-weight: 900; letter-spacing: 0.5px; color: #000; text-transform: uppercase; }
    .machine-tag { display: inline-block; background: ${machineBg}; color: #fff; font-size: 8.5pt; font-weight: 800; padding: 2px 14px; border-radius: 3px; margin-top: 3px; letter-spacing: 1px; }

    /* Stage Banner */
    .stage-banner { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; background: ${stageBg}; border-bottom: 1px solid ${stageBorder}; font-size: 13px; font-weight: 700; color: ${stageColor}; }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: ${stageColor}; display: inline-block; margin-right: 6px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #000; padding: 5px 8px; font-size: 10pt; vertical-align: middle; }
    .label { font-weight: 800; background: #f8fafc; width: 15%; white-space: nowrap; font-size: 8.5pt; }
    .val { font-weight: 600; }
    .val-highlight { font-weight: 800; color: #1e3a8a; }

    /* Artwork Box */
    .artworks-wrap { padding: 10px 14px; border-bottom: 1px solid #000; background: #fff; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

    /* Notes */
    .note-row { padding: 6px 14px; border-bottom: 1px solid #000; font-size: 9.5pt; }
    .note-row strong { font-weight: 800; }
    .emrg-note { color: #dc2626; background: #fef2f2; }

    /* Actions */
    .actions-bar { padding: 12px 14px; background: #f8fafc; display: flex; gap: 10px; justify-content: center; border-top: 1px solid #e2e8f0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 18px; border-radius: 6px; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; border: none; }
    .btn-primary { background: #2563eb; color: #ffffff; }
    .btn-secondary { background: #e2e8f0; color: #334155; }
    
    @media (max-width: 480px) {
      body { padding: 6px; }
      td, th { padding: 4px 6px; font-size: 8.5pt; }
      .label { font-size: 7.5pt; }
      .company-title { font-size: 12pt; }
    }
  </style>
</head>
<body>
  <div class="card-container">
    <div class="header-bar">
      <img class="header-logo" src="/DigitalLogo.png" alt="Elite Digital Prints" onerror="this.style.display='none'">
      <div class="header-center">
        <div class="company-title">ELITE DIGITAL</div>
        <div class="machine-tag">${machine}</div>
      </div>
      <div style="font-size: 11px; font-weight: 800; color: #475569; text-align: right; line-height: 1.2;">
        OFFICIAL<br/>JOB CARD
      </div>
    </div>

    <div class="stage-banner">
      <div>
        <span class="badge-dot"></span>
        <span>STATUS: <strong>${card.status || 'Active'}</strong></span>
      </div>
      <div>${stageLabel}</div>
    </div>

    <!-- MAIN SPECIFICATIONS -->
    <table>
      <tr>
        <td class="label">JOB NO. :</td>
        <td class="val val-highlight">${jobNo}</td>
        <td class="label">COLORS :</td>
        <td class="val">${card.colors || '—'}</td>
        <td class="label">DATE :</td>
        <td class="val">${dateStr}</td>
      </tr>
      <tr>
        <td class="label">D. NO. :</td>
        <td class="val val-highlight">${designNo}</td>
        <td class="label">PANNA :</td>
        <td class="val">${card.panna || '—'}</td>
        <td class="label">PASS :</td>
        <td class="val">${card.pass || '—'}</td>
      </tr>
      <tr>
        <td class="label">FABRIC :</td>
        <td class="val">${card.fabric || '—'}</td>
        <td class="label">CON. :</td>
        <td class="val">${card.consumption || '—'}</td>
        <td class="label">ALL OVER :</td>
        <td class="val">${card.allover || '—'}</td>
      </tr>
      <tr>
        <td class="label">PCS :</td>
        <td class="val">${card.pcs || '—'}</td>
        <td class="label">BOTTOM :</td>
        <td class="val">${card.bottom || '—'}</td>
        <td class="label">PN/KM :</td>
        <td class="val">${card.pnKm || '—'}</td>
      </tr>
      <tr>
        <td class="label">TOP :</td>
        <td class="val">${card.top || '—'}</td>
        <td class="label">DUPATTA :</td>
        <td class="val">${card.dupatta || '—'}</td>
        <td class="label">SET-COPY :</td>
        <td class="val">${card.setCopy || '—'}</td>
      </tr>
      <tr>
        <td class="label">SLEEVE :</td>
        <td class="val">${card.sleeve || '—'}</td>
        <td class="label">CUT :</td>
        <td class="val">${card.cut || '—'}</td>
        <td class="label" style="background: #e0f2fe; color: #0369a1;">TOTAL MTR :</td>
        <td class="val val-highlight" style="font-size: 11pt; color: #0284c7;">${card.totalMtr || '—'}</td>
      </tr>
      <tr>
        <td class="label">PARTY :</td>
        <td class="val val-highlight" colspan="5" style="font-size: 10.5pt;">${card.party || '—'}</td>
      </tr>
    </table>

    <!-- DESIGN ARTWORKS -->
    ${imagesHtml ? `<div class="artworks-wrap">${imagesHtml}</div>` : ''}

    <!-- NOTES SECTION -->
    ${card.note1 ? `<div class="note-row"><strong>NOTE 1 :</strong> ${card.note1}</div>` : ''}
    ${card.emergencyNotes ? `<div class="note-row emrg-note"><strong>EMRG. NOTE :</strong> ${card.emergencyNotes}</div>` : ''}
    ${card.note2 ? `<div class="note-row"><strong>NOTE 2 :</strong> ${card.note2}</div>` : ''}

    <!-- TECHNICAL & PRE-PRESS -->
    <table>
      <tr>
        <td class="label">DESIGNER :</td>
        <td class="val">${card.designer || '—'}</td>
        <td class="label">C. M. :</td>
        <td class="val">${card.colourMatching || card.cm || '—'}</td>
      </tr>
      <tr>
        <td class="label">EXP. TIME :</td>
        <td class="val">${card.expTime || '—'}</td>
        <td class="label">PAPER TYPE :</td>
        <td class="val">${card.paperType || '—'}</td>
      </tr>
      <tr>
        <td class="label">OPERATOR :</td>
        <td class="val">${card.operator || '—'}</td>
        <td class="label">PRINT DATE :</td>
        <td class="val">${printDateStr}</td>
      </tr>
      <tr>
        <td class="label">ROLL NO. :</td>
        <td class="val">${card.rollNo || '—'}</td>
        <td class="label">PRINT MTR :</td>
        <td class="val val-highlight">${card.printMtr || '—'}</td>
      </tr>
    </table>

    <!-- FUSING & FINISHING -->
    <table>
      <tr>
        <td class="label" style="text-align: center; width: 14%;">FUSING</td>
        <td class="label" style="width: 14%;">TEMP. :</td>
        <td class="val" style="width: 22%;">${card.temperature || card.fusingTemp || '235'}</td>
        <td class="label" style="width: 14%;">SPEED :</td>
        <td class="val" style="width: 36%;">${card.speed || '40'}</td>
      </tr>
    </table>

    <div class="actions-bar">
      <a href="/v1/jobcards/pdf/${card._id}" class="btn btn-primary" download>
        ⬇ Download PDF
      </a>
      <a href="https://erp.eliteedition.in/#jobcards_list" class="btn btn-secondary">
        Open ERP Portal
      </a>
    </div>
  </div>
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
