const FabricChallan = require('../db/models/fabricChallan.model');
const FabricTransaction = require('../db/models/fabricTransaction.model');
const JobCard = require('../db/models/jobCard.model');

// ── Helper: compute totals from tpDetails ──────────────────────────────────
function computeTotals(tpDetails = []) {
  let totalMtr = 0;
  let totalTp = 0;
  for (const tp of tpDetails) {
    const m = parseFloat(tp.tpMeter) || 0;
    if (m > 0) {
      totalMtr += m;
      totalTp += 1;
    }
  }
  return { totalMtr: parseFloat(totalMtr.toFixed(3)), totalTp };
}

// ── GET /fabric-challan/next-no ────────────────────────────────────────────
const getNextChallanNo = async (req, res) => {
  try {
    const CHALLAN_START_NO = 621;
    const last = await FabricChallan.findOne({}, 'challanNo').sort({ challanNo: -1 });
    const next = last && last.challanNo
      ? Math.max(last.challanNo + 1, CHALLAN_START_NO)
      : CHALLAN_START_NO;
    res.json({ success: true, nextNo: next });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan/lot-info/:lotNo ───────────────────────────────────
// Returns inward transaction details for a given lot number
const getLotInfo = async (req, res) => {
  try {
    const lotNo = parseInt(req.params.lotNo);
    if (isNaN(lotNo)) {
      return res.status(400).json({ success: false, error: 'Invalid lot number' });
    }
    const tx = await FabricTransaction.findOne({ type: 'INWARD', lotNo });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Lot not found' });
    }
    res.json({
      success: true,
      data: {
        lotNo: tx.lotNo,
        vendorChallanNo: tx.challanNo || '',
        fabricName: tx.fabricQuality || '',
        shortagePct: tx.shortagePct != null ? tx.shortagePct : null,
        panna: tx.panna || '',
        vendorName: tx.vendorName || '',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Helper: compute raw meters from fresh meters + shortage % ──────────────
function computeRawMeters(totalMtr, shortagePct) {
  const mtr = parseFloat(totalMtr) || 0;
  const pct = parseFloat(shortagePct) || 0;
  // Raw = fresh meters + shortage
  // e.g. 100 mtr + 5% shortage = 105 raw meters consumed from stock
  return parseFloat((mtr * (1 + pct / 100)).toFixed(3));
}

// ── Helper: safely extract first lot number from a lot string ──────────────
function parseLotNo(lotStr) {
  if (!lotStr) return undefined;
  const match = String(lotStr).match(/\d+/);
  if (match) {
    const val = parseInt(match[0], 10);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

// ── Helper: Automated Lot Allocation Program Logic ─────────────────────────
// Automatically allocates lot numbers across TP details based on available inward stock
// (or distributes fallback lots across TP rows if no inward stock is recorded yet).
async function allocateLotsForChallan(fabricName, panna, rawLotNoStr, tpDetails) {
  const details = Array.isArray(tpDetails) ? tpDetails : [];
  if (!fabricName || details.length === 0) {
    return {
      sanitizedDetails: details,
      finalLotNoStr: rawLotNoStr || '',
      lotGroups: {}
    };
  }

  // 1. Fetch available INWARD lot stocks for this fabric
  let availableLots = [];
  try {
    const cleanFabric = fabricName.trim();
    const re = new RegExp(`^${cleanFabric.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');
    
    const matchFilter = {
      fabricQuality: re,
      lotNo: { $ne: null }
    };
    if (panna && String(panna).trim()) {
      const cleanP = String(panna).trim().replace(/['"]/g, '');
      matchFilter.panna = new RegExp(`^${cleanP}["']?$`, 'i');
    }
    
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$lotNo',
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
        }
      },
      {
        $project: {
          lotNo: '$_id',
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      { $match: { currentStock: { $gt: 0 } } },
      { $sort: { lotNo: 1 } } // FIFO: oldest lot first
    ];

    availableLots = await FabricTransaction.aggregate(pipeline);
  } catch (e) {
    console.warn('Failed to query inward lot stock:', e.message);
  }

  // Parse existing/header lot numbers string (e.g. "330,328,317" -> ["330", "328", "317"])
  const fallbackLots = (rawLotNoStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const sanitizedDetails = [];
  const usedLotsSet = new Set();
  const lotGroups = {};

  // Build prioritized lotStockMap:
  // If user specified lots (e.g. ["330", "328", "317"]), use ONLY those specified lots!
  const lotStockMap = [];

  if (fallbackLots.length > 0) {
    for (const fLot of fallbackLots) {
      const match = availableLots.find(l => String(l.lotNo) === fLot);
      const rem = match ? match.currentStock : Infinity;
      lotStockMap.push({ lotNo: fLot, remaining: rem });
    }
  } else {
    // If no specific lots provided, fall back to available FIFO lots from database
    for (const aLot of availableLots) {
      lotStockMap.push({ lotNo: String(aLot.lotNo), remaining: aLot.currentStock });
    }
  }

  if (lotStockMap.length > 0) {
    let lotIdx = 0;

    for (const tp of details) {
      const m = parseFloat(tp.tpMeter) || 0;
      if (m <= 0) {
        sanitizedDetails.push({ ...tp, lotNo: '' });
        continue;
      }

      let needed = m;
      let assignedLots = [];

      while (needed > 0 && lotIdx < lotStockMap.length) {
        const curLot = lotStockMap[lotIdx];
        if (curLot.remaining <= 0) {
          lotIdx++;
          continue;
        }

        const take = curLot.remaining === Infinity ? needed : Math.min(needed, curLot.remaining);
        if (curLot.remaining !== Infinity) curLot.remaining -= take;
        needed -= take;

        const lotStr = curLot.lotNo;
        if (!assignedLots.includes(lotStr)) assignedLots.push(lotStr);
        usedLotsSet.add(lotStr);

        lotGroups[lotStr] = (lotGroups[lotStr] || 0) + take;

        if (curLot.remaining <= 0) {
          lotIdx++;
        }
      }

      if (needed > 0) {
        // Remaining meters beyond available stock -> assign to last used lot or fallback lot
        const lastLot = assignedLots.length > 0 ? assignedLots[assignedLots.length - 1] : (fallbackLots[0] || '1');
        if (!assignedLots.includes(lastLot)) assignedLots.push(lastLot);
        usedLotsSet.add(lastLot);
        lotGroups[lastLot] = (lotGroups[lastLot] || 0) + needed;
      }

      sanitizedDetails.push({
        ...tp,
        lotNo: assignedLots.join(', ')
      });
    }
  } else {
    // No inward stock records in DB yet -> distribute fallback lots across TP rows programmatically
    const defaultLot = fallbackLots[0] || '1';
    let fIdx = 0;
    const itemsPerLot = fallbackLots.length > 1 ? Math.ceil(details.length / fallbackLots.length) : details.length;

    details.forEach((tp, idx) => {
      const m = parseFloat(tp.tpMeter) || 0;
      if (m <= 0) {
        sanitizedDetails.push({ ...tp, lotNo: '' });
        return;
      }

      if (fallbackLots.length > 1 && idx > 0 && idx % itemsPerLot === 0) {
        if (fIdx < fallbackLots.length - 1) fIdx++;
      }

      const assignedLot = fallbackLots[fIdx] || defaultLot;
      usedLotsSet.add(assignedLot);
      lotGroups[assignedLot] = (lotGroups[assignedLot] || 0) + m;

      sanitizedDetails.push({
        ...tp,
        lotNo: assignedLot
      });
    });
  }

  const finalLotNoStr = Array.from(usedLotsSet).join(', ') || rawLotNoStr || '';

  return {
    sanitizedDetails,
    finalLotNoStr,
    lotGroups
  };
}

// ── Helper: normalize fabric and panna widths ─────────────────────────────
const normalizeFabric = (val) => {
  if (!val) return '';
  let clean = String(val).trim().toUpperCase();
  if (clean === 'CREPE' || clean === 'CRAPE' || clean === 'FRANCH CREPE' || clean === 'FRENCH CREP' || clean.includes('CREPE') || clean.includes('CRAPE')) {
    return 'FRENCH CREPE';
  }
  if (clean === 'CAMRIK' || clean === 'CEMBRIC' || clean === 'CEMBRIK' || clean === 'CAMBRIK' || clean.includes('CAMRIK') || clean.includes('CEMBRIK')) {
    return 'CAMBRIC';
  }
  return clean;
};

const normalizePanna = (val, fabricName = '') => {
  let clean = val ? String(val).trim().replace(/['"]/g, '') : '';
  if (!clean || clean.toUpperCase() === 'UNKNOWN') {
    const fabUpper = String(fabricName || '').trim().toUpperCase();
    if (fabUpper.includes('ARMANI')) {
      return '44';
    }
    return '58';
  }
  return clean;
};

// ── POST /fabric-challan ───────────────────────────────────────────────────
const createChallan = async (req, res) => {
  try {
    const {
      date, partyName,
      lotNo, vendorChallanNo, deliveryBy, fabricName, shortagePct,
      jobNo, designNo, colour, panna,
      tpDetails, pcs,
      notes, createdBy,
      billTo, shipTo,
    } = req.body;

    const normFabric = normalizeFabric(fabricName || '');
    const normP = normalizePanna(panna || '', normFabric);
    const details = Array.isArray(tpDetails) ? tpDetails : [];

    // Program-side automated lot allocation
    const { sanitizedDetails, finalLotNoStr, lotGroups } = await allocateLotsForChallan(
      normFabric,
      normP,
      lotNo ? String(lotNo) : '',
      details
    );

    const { totalMtr, totalTp } = computeTotals(sanitizedDetails);

    const challan = new FabricChallan({
      date: date ? new Date(date) : new Date(),
      partyName: partyName || '',
      lotNo: finalLotNoStr,
      vendorChallanNo: vendorChallanNo || '',
      deliveryBy: deliveryBy || '',
      fabricName: normFabric,
      shortagePct: shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null,
      jobNo: jobNo || '',
      designNo: designNo || '',
      colour: colour || '',
      panna: normP,
      tpDetails: sanitizedDetails,
      totalMtr,
      totalTp,
      pcs: pcs !== '' && pcs != null ? parseInt(pcs) : 0,
      billTo: billTo || '',
      shipTo: shipTo || '',
      notes: notes || '',
      createdBy: createdBy || '',
    });

    await challan.save();

    // ── Auto-create OUTWARD fabric transactions (lot-wise) ──────────────
    if (fabricName && totalMtr > 0 && Object.keys(lotGroups).length > 0) {
      try {
        const createdTxIds = [];
        for (const [lot, groupMtr] of Object.entries(lotGroups)) {
          const rawMtr = computeRawMeters(groupMtr, challan.shortagePct);
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            fabricQuality: fabricName,
            panna: panna || '',
            lotNo: parseLotNo(lot),
            qty: rawMtr,
            date: challan.date,
            jobNo: jobNo || '',
            partyName: partyName || '',
            challanNo: 'EDP-' + challan.challanNo,
            notes: `Auto: EDP-${challan.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan.shortagePct || 0}% shortage = ${rawMtr}m raw`,
          });
          await outwardTx.save();
          createdTxIds.push(outwardTx._id);
        }
        challan.fabricOutwardIds = createdTxIds;
        await challan.save();
      } catch (txErr) {
        console.error('Warning: Failed to auto-create fabric outward transactions:', txErr.message);
      }
    }

    res.status(201).json({ success: true, data: challan });
  } catch (error) {
    console.error('Error creating fabric challan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan ────────────────────────────────────────────────────
const getChallans = async (req, res) => {
  try {
    const { dateStart, dateEnd, search, page = 1, limit = 200 } = req.query;
    const filter = {};

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { partyName: re },
        { fabricName: re },
        { jobNo: re },
        { designNo: re },
        { colour: re },
      ];
    }

    const challans = await FabricChallan.find(filter)
      .sort({ challanNo: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: challans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── PUT /fabric-challan/:id ────────────────────────────────────────────────
const updateChallan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date, partyName,
      lotNo, vendorChallanNo, deliveryBy, fabricName, shortagePct,
      jobNo, designNo, colour, panna,
      tpDetails, pcs, notes,
      billTo, shipTo,
    } = req.body;

    const challan = await FabricChallan.findById(id);
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Challan not found' });
    }

    if (date !== undefined) challan.date = new Date(date);
    if (partyName !== undefined) challan.partyName = partyName;
    if (vendorChallanNo !== undefined) challan.vendorChallanNo = vendorChallanNo;
    if (deliveryBy !== undefined) challan.deliveryBy = deliveryBy;
    if (fabricName !== undefined) challan.fabricName = fabricName;
    if (shortagePct !== undefined) challan.shortagePct = shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null;
    if (jobNo !== undefined) challan.jobNo = jobNo;
    if (designNo !== undefined) challan.designNo = designNo;
    if (colour !== undefined) challan.colour = colour;
    if (panna !== undefined) challan.panna = panna;
    if (pcs !== undefined) challan.pcs = pcs !== '' && pcs != null ? parseInt(pcs) : 0;
    if (billTo !== undefined) challan.billTo = billTo;
    if (shipTo !== undefined) challan.shipTo = shipTo;
    if (notes !== undefined) challan.notes = notes;

    const details = tpDetails !== undefined ? (Array.isArray(tpDetails) ? tpDetails : []) : challan.tpDetails;
    const rawLotStr = lotNo !== undefined ? String(lotNo) : challan.lotNo;

    // Run program-side automated lot allocation
    const { sanitizedDetails, finalLotNoStr, lotGroups } = await allocateLotsForChallan(
      challan.fabricName,
      challan.panna,
      rawLotStr,
      details
    );

    const { totalMtr, totalTp } = computeTotals(sanitizedDetails);
    challan.tpDetails = sanitizedDetails;
    challan.lotNo = finalLotNoStr;
    challan.totalMtr = totalMtr;
    challan.totalTp = totalTp;

    await challan.save();

    // ── Sync OUTWARD fabric transactions: delete old, create new ──────────────
    try {
      // Delete old single outward link if exists (backwards compatibility)
      if (challan.fabricOutwardId) {
        await FabricTransaction.findByIdAndDelete(challan.fabricOutwardId);
        challan.fabricOutwardId = null;
      }
      // Delete all old lot-wise outward links
      if (challan.fabricOutwardIds && challan.fabricOutwardIds.length > 0) {
        for (const txId of challan.fabricOutwardIds) {
          await FabricTransaction.findByIdAndDelete(txId);
        }
        challan.fabricOutwardIds = [];
      }

      if (challan.fabricName && challan.totalMtr > 0 && Object.keys(lotGroups).length > 0) {
        const createdTxIds = [];
        for (const [lot, groupMtr] of Object.entries(lotGroups)) {
          const rawMtr = computeRawMeters(groupMtr, challan.shortagePct);
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            fabricQuality: challan.fabricName,
            panna: challan.panna || '',
            lotNo: parseLotNo(lot),
            qty: rawMtr,
            date: challan.date,
            jobNo: challan.jobNo || '',
            partyName: challan.partyName || '',
            challanNo: 'EDP-' + challan.challanNo,
            notes: `Auto: EDP-${challan.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan.shortagePct || 0}% shortage = ${rawMtr}m raw`,
          });
          await outwardTx.save();
          createdTxIds.push(outwardTx._id);
        }
        challan.fabricOutwardIds = createdTxIds;
        await challan.save();
      }
    } catch (txErr) {
      console.error('Warning: Failed to sync fabric outward transactions on update:', txErr.message);
    }

    res.json({ success: true, data: challan });
  } catch (error) {
    console.error('Error updating fabric challan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /fabric-challan/:id ─────────────────────────────────────────────
const deleteChallan = async (req, res) => {
  try {
    const challan = await FabricChallan.findById(req.params.id);
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Challan not found' });
    }

    // Remove the linked outward fabric transactions first
    if (challan.fabricOutwardId) {
      try {
        await FabricTransaction.findByIdAndDelete(challan.fabricOutwardId);
      } catch (txErr) {
        console.error('Warning: Failed to delete linked fabric outward:', txErr.message);
      }
    }
    if (challan.fabricOutwardIds && challan.fabricOutwardIds.length > 0) {
      for (const txId of challan.fabricOutwardIds) {
        try {
          await FabricTransaction.findByIdAndDelete(txId);
        } catch (txErr) {
          console.error('Warning: Failed to delete linked fabric outward:', txErr.message);
        }
      }
    }

    // Failsafe: delete any outward transaction that matches this challan no (e.g. EDP-1)
    if (challan.challanNo) {
      try {
        await FabricTransaction.deleteMany({
          type: 'OUTWARD',
          challanNo: 'EDP-' + challan.challanNo
        });
      } catch (txErr) {
        console.error('Warning: Failsafe deletion of outward transactions failed:', txErr.message);
      }
    }

    await FabricChallan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Challan and linked fabric outward deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /fabric-challan/reset-all ─────────────────────────────────────────
const resetAllChallans = async (req, res) => {
  try {
    await FabricChallan.deleteMany({});
    await FabricTransaction.deleteMany({ challanNo: { $regex: /^EDP-/i } });
    res.json({ success: true, message: 'All fabric challans and linked transactions reset successfully. Next Challan No will start at 1.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan/:id/pdf ───────────────────────────────────────────
const downloadChallanPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const challan = await FabricChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EDP-${challan.challanNo || 'preview'}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 45, MR = 28;
    const contentWidth = PW - ML - MR;

    let billTo = challan.billTo || '';
    let shipTo = challan.shipTo || '';
    if (!billTo || !shipTo) {
      if (challan.jobNo) {
        try {
          const job = await JobCard.findOne({ jobNo: challan.jobNo });
          if (job) {
            if (!billTo) billTo = job.billTo || '';
            if (!shipTo) shipTo = job.shipTo || '';
          }
        } catch (e) {
          console.warn('Failed to find job card info', e);
        }
      }
    }
    if (!billTo) billTo = '—';
    if (!shipTo) shipTo = '—';

    const selectedLogoName = 'Logo.png';
    const logoPath = path.join(__dirname, selectedLogoName);

    const formattedDate = challan.date ? new Date(challan.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    const activeTps = (challan.tpDetails || [])
      .filter(tp => tp.tpMeter != null && parseFloat(tp.tpMeter) > 0);

    const activeCount = activeTps.length;
    const tpColsCount = activeCount <= 10 ? 1 : activeCount <= 20 ? 2 : 3;
    const tpColWidth = contentWidth / tpColsCount;
    const tpRowHeight = 26;
    const tableHeaderHeight = 26;
    const tpSectionY = MR + 98 + 68 + 34 + 34 + 12; // startY + 68 + 34 (Colour/Fabric row) + 12
    const tpTableStartY = tpSectionY + 16;
    const rowsPerCol = Math.ceil(activeCount / tpColsCount);

    // Resolve Image Path helper
    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '');
      try {
        filename = decodeURIComponent(filename);
      } catch (e) {}
      
      const possibleDirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        path.join(__dirname, '../Digital print')
      ];
      for (const pDir of possibleDirs) {
        const fullPath = path.join(pDir, filename);
        if (fs.existsSync(fullPath)) return fullPath;
      }
      return null;
    };

    let firstDesignImg = null;

    // 1. Try finding design image by JobCard
    if (challan.jobNo) {
      const jobTokens = String(challan.jobNo).split(',').map(s => s.trim()).filter(Boolean);
      for (const jNo of jobTokens) {
        try {
          const job = await JobCard.findOne({ jobNo: jNo });
          if (job) {
            if (job.imageUrl1) {
              const p = resolveImagePath(job.imageUrl1);
              if (p) { firstDesignImg = { path: p, label: `Design: ${job.designNo || challan.designNo || ''}` }; break; }
            }
            if (job.imageUrl2) {
              const p = resolveImagePath(job.imageUrl2);
              if (p) { firstDesignImg = { path: p, label: `Design: ${job.designNo || challan.designNo || ''}` }; break; }
            }
          }
        } catch (e) {}
      }
    }

    // 2. Try finding design image by Design No
    if (!firstDesignImg && challan.designNo) {
      const designTokens = String(challan.designNo)
        .split(/[,\s&]+/)
        .map(s => s.trim())
        .filter(Boolean);

      for (const dName of designTokens) {
        const cleanName = dName.replace(/^ED-/i, '');
        try {
          const Design = require('../db/models/design.model');
          const dDoc = await Design.findOne({ 
            designName: { $regex: new RegExp(`^(ED-)?${cleanName}$`, 'i') } 
          });
          if (dDoc) {
            if (dDoc.imageUrl) {
              const p = resolveImagePath(dDoc.imageUrl);
              if (p) { firstDesignImg = { path: p, label: `Design: ${dDoc.designName}` }; break; }
            }
            if (dDoc.imageUrl2) {
              const p = resolveImagePath(dDoc.imageUrl2);
              if (p) { firstDesignImg = { path: p, label: `Design: ${dDoc.designName}` }; break; }
            }
          }
        } catch (e) {}

        const directCandidates = [dName, `ED-${dName}`, cleanName, `ED-${cleanName}`];
        for (const cand of directCandidates) {
          for (const ext of ['.jpg', '.jpeg', '.png']) {
            const testPath = path.join(__dirname, '../../elite_edition_images', `${cand}${ext}`);
            if (fs.existsSync(testPath)) {
              firstDesignImg = { path: testPath, label: `Design: ${cand}` };
              break;
            }
          }
          if (firstDesignImg) break;
        }
        if (firstDesignImg) break;
      }
    }

    const hasNotes = !!(challan.notes && challan.notes.trim());
    const hasPcs = !!(challan.pcs);

    const getColor = (colorStr, isColorPage) => {
      if (isColorPage) return colorStr;
      if (colorStr === '#dc2626') return '#dc2626'; // Keep Challan No & Total TP in RED!
      if (colorStr === '#475569') return '#555555'; // Expected Pcs text in Gray
      return '#000000'; // Everything else B&W
    };

    const renderPage = (isColorPage) => {
      // Draw border
      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(1)
         .rect(ML, MR, contentWidth, PH - 2 * MR).stroke();

      // Top line texts
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(10.5).font('Helvetica')
        .text('GST : 24AANFE0044M1ZG', ML + 12, MR + 4, { lineBreak: false });
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(10.5).font('Helvetica-Bold')
        .text('|| Shree Ganeshay Namah ||', ML, MR + 4, { width: contentWidth, align: 'center', lineBreak: false });
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(10.5).font('Helvetica')
        .text('Mo. +91 99098 66667', ML, MR + 4, { width: contentWidth - 12, align: 'right', lineBreak: false });

      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5)
        .moveTo(ML, MR + 14).lineTo(PW - MR, MR + 14).stroke();

      // Logo
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, ML + (contentWidth - 130) / 2, MR + 29, { width: 130 });
      }

      // Pin
      const drawMapPin = (d, x, y) => {
        d.save();
        d.fillColor(getColor('#0000ff', isColorPage));
        d.translate(x, y);
        d.moveTo(0, 0)
         .bezierCurveTo(-4, -4, -4, -9, 0, -9)
         .bezierCurveTo(4, -9, 4, -4, 0, 0)
         .fill();
        d.fillColor('#ffffff')
         .circle(0, -5, 1.5)
         .fill();
        d.restore();
      };

      const addressText = 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, NR. KALAPUL, Punagam, Surat';
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(10).font('Helvetica-Bold');
      const textWidth = doc.widthOfString(addressText);
      const startX = ML + (contentWidth - textWidth) / 2;
      
      drawMapPin(doc, startX - 8, MR + 79 + 7);
      doc.text(addressText, startX, MR + 79, { lineBreak: false });

      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.8)
        .moveTo(ML, MR + 94).lineTo(PW - MR, MR + 94).stroke();

      const startY = MR + 98;

      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12.5).font('Helvetica-Bold')
        .text('M/S:', ML + 12, startY + 6, { lineBreak: false });
      doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(14.5).font('Helvetica-Bold')
        .text(challan.partyName || '—', ML + 42, startY + 4, { lineBreak: false });
        
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12.5).font('Helvetica-Bold')
        .text('DATE:', PW - MR - 260, startY + 6, { width: 48, align: 'right', lineBreak: false });
      doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(13).font('Helvetica-Bold')
        .text(formattedDate, PW - MR - 210, startY + 6, { width: 80, align: 'left', lineBreak: false });

      // CH. NO. label — right-aligned
      const challanLabel = 'CH. NO.:';
      const challanValue = 'EDP-' + (challan.challanNo || '—');
      const rightEdge = PW - MR - 8;          
      const chNoValueW = 70;                   
      const chNoLabelW = 58;                   
      const chNoValueX = rightEdge - chNoValueW;
      const chNoLabelX = chNoValueX - chNoLabelW;

      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12.5).font('Helvetica-Bold')
        .text(challanLabel, chNoLabelX, startY + 6, { width: chNoLabelW, align: 'right', lineBreak: false });

      doc.fillColor(getColor('#dc2626', isColorPage)).fontSize(14.5).font('Helvetica-Bold')
        .text(challanValue, chNoValueX, startY + 4, { width: chNoValueW, align: 'right', lineBreak: false });

      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.6)
        .moveTo(ML, startY + 28).lineTo(PW - MR, startY + 28).stroke();

      function renderField(label, value, x, y, width, height) {
        doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5)
          .rect(x, y, width, height).stroke();

        doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(9.5).font('Helvetica-Bold')
          .text(label.toUpperCase(), x + 6, y + 3, { width: width - 12, align: 'left', lineBreak: false });

        const valStr = String(value || '—').trim();
        let fontSize = 12;
        if (valStr.length > 28) {
          fontSize = 7.5;
        } else if (valStr.length > 18) {
          fontSize = 8.5;
        } else if (valStr.length > 11) {
          fontSize = 9.5;
        }

        doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(fontSize).font('Helvetica-Bold')
          .text(valStr, x + 6, y + 15, { width: width - 12, align: 'left', lineBreak: true, height: height - 16 });
      }

      const billStartY = startY + 28;
      const halfWidth = contentWidth / 2;
      renderField('Bill to', billTo, ML, billStartY, halfWidth, 34);
      renderField('Ship to', shipTo, ML + halfWidth, billStartY, halfWidth, 34);

      const gridStartY = billStartY + 34;
      const colWidth4 = contentWidth / 4;

      renderField('Job No.', challan.jobNo, ML, gridStartY, colWidth4, 34);
      renderField('Design No.', challan.designNo, ML + colWidth4, gridStartY, colWidth4, 34);
      renderField('Lot No.', challan.lotNo ? `#${challan.lotNo}` : '—', ML + colWidth4 * 2, gridStartY, colWidth4, 34);
      renderField('Panno', challan.panna, ML + colWidth4 * 3, gridStartY, colWidth4, 34);

      renderField('Colour', challan.colour, ML, gridStartY + 34, colWidth4, 34);
      renderField('Fabric', challan.fabricName, ML + colWidth4, gridStartY + 34, colWidth4, 34);
      renderField('Vendor Challan', challan.vendorChallanNo, ML + colWidth4 * 2, gridStartY + 34, colWidth4, 34);
      renderField('Delivery By', challan.deliveryBy, ML + colWidth4 * 3, gridStartY + 34, colWidth4, 34);

      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(13).font('Helvetica-Bold')
        .text('TP Details', ML + 16, tpSectionY, { lineBreak: false });

      for (let c = 0; c < tpColsCount; c++) {
        const x = ML + c * tpColWidth;
        doc.rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).fill(isColorPage ? '#f8fafc' : '#ffffff');
        doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).stroke();
        
        doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12).font('Helvetica-Bold')
          .text('TP NO.', x, tpTableStartY + 7, { width: tpColWidth * 0.35, align: 'center' });
        doc.text('METRES', x + tpColWidth * 0.35, tpTableStartY + 7, { width: tpColWidth * 0.65, align: 'center' });
      }

      if (activeCount === 0) {
        const x = ML;
        const y = tpTableStartY + tableHeaderHeight;
        doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(x, y, contentWidth, tpRowHeight).stroke();
        doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12.5).font('Helvetica-Oblique')
          .text('No active TP details entered.', x, y + 7, { width: contentWidth, align: 'center' });
      } else {
        for (let i = 0; i < activeCount; i++) {
          const tp = activeTps[i];
          const colIndex = Math.floor(i / rowsPerCol);
          const rowIndex = i % rowsPerCol;

          const x = ML + colIndex * tpColWidth;
          const y = tpTableStartY + tableHeaderHeight + rowIndex * tpRowHeight;

          doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(x, y, tpColWidth, tpRowHeight).stroke();

          const val = `${parseFloat(tp.tpMeter).toFixed(2)} mtr`;

          doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12.5).font('Helvetica-Bold')
            .text(String(tp.tpNo), x, y + 7, { width: tpColWidth * 0.35, align: 'center' });
          
          doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(13).font('Helvetica')
            .text(val, x + tpColWidth * 0.35, y + 7, { width: tpColWidth * 0.65, align: 'center' });
        }
      }

      const summaryStartY = tpTableStartY + tableHeaderHeight + (activeCount > 0 ? rowsPerCol * tpRowHeight : tpRowHeight) + 15;
      const summaryColWidth2 = contentWidth / 2;

      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(ML, summaryStartY, summaryColWidth2, 48).stroke();
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(11.5).font('Helvetica-Bold')
        .text('TOTAL CHALLAN TP', ML, summaryStartY + 8, { width: summaryColWidth2, align: 'center' });
      doc.fillColor(getColor('#dc2626', isColorPage)).fontSize(17).font('Helvetica-Bold')
        .text(String(challan.totalTp || 0), ML, summaryStartY + 23, { width: summaryColWidth2, align: 'center' });

      doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(ML + summaryColWidth2, summaryStartY, summaryColWidth2, 48).stroke();
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(11.5).font('Helvetica-Bold')
        .text('TOTAL CHALLAN METRES', ML + summaryColWidth2, summaryStartY + 8, { width: summaryColWidth2, align: 'center' });
      doc.fillColor(getColor('#10b981', isColorPage)).fontSize(17).font('Helvetica-Bold')
        .text(`${parseFloat(challan.totalMtr || 0).toFixed(2)} mtr`, ML + summaryColWidth2, summaryStartY + 23, { width: summaryColWidth2, align: 'center' });

      let notesEndY = summaryStartY + 48;

      if (hasNotes || hasPcs) {
        const notesY = summaryStartY + 60;
        notesEndY = notesY + 42;
        doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).rect(ML, notesY, contentWidth, 42).stroke();
        doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(11.5).font('Helvetica-Bold')
          .text('NOTES / REMARKS', ML + 12, notesY + 6, { width: contentWidth - 24 });
        
        if (hasNotes && hasPcs) {
          doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(11).font('Helvetica')
            .text(challan.notes, ML + 12, notesY + 18, { width: contentWidth - 24 });
          doc.fillColor(getColor('#475569', isColorPage)).fontSize(9).font('Helvetica-Bold')
            .text(`Expected Pcs: ${challan.pcs}`, ML + 12, notesY + 30, { width: contentWidth - 24 });
        } else if (hasNotes) {
          doc.fillColor(getColor('#0f172a', isColorPage)).fontSize(11.5).font('Helvetica')
            .text(challan.notes, ML + 12, notesY + 20, { width: contentWidth - 24 });
        } else if (hasPcs) {
          doc.fillColor(getColor('#475569', isColorPage)).fontSize(9.5).font('Helvetica-Bold')
            .text(`Expected Pcs: ${challan.pcs}`, ML + 12, notesY + 20, { width: contentWidth - 24 });
        }
      }

      const sigLineY = PH - MR - 45;

      // ── EMBED DESIGN IMAGE AT BOTTOM CENTER ──
      if (firstDesignImg && firstDesignImg.path) {
        const imgBoxW = 140;
        const imgBoxH = 90;
        const imgBoxX = ML + (contentWidth - imgBoxW) / 2;
        
        const availTop = notesEndY + 8;
        const availBottom = sigLineY - 8;
        let imgBoxY = availTop + (availBottom - availTop - imgBoxH) / 2;

        if (imgBoxY < availTop) imgBoxY = availTop;

        // Draw image frame box
        doc.strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5)
          .rect(imgBoxX, imgBoxY, imgBoxW, imgBoxH).stroke();

        try {
          doc.image(firstDesignImg.path, imgBoxX + 3, imgBoxY + 3, {
            fit: [imgBoxW - 6, imgBoxH - 6],
            align: 'center',
            valign: 'center'
          });
        } catch (e) {
          console.warn('Failed to embed design image at bottom center:', e.message);
        }
      }
      
      doc.moveTo(ML + 30, sigLineY).lineTo(ML + 160, sigLineY).strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).stroke();
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12).font('Helvetica-Bold')
        .text('RECEIVER SIGNATURE', ML + 30, sigLineY + 5, { width: 130, align: 'center' });

      doc.moveTo(PW - MR - 160, sigLineY).lineTo(PW - MR - 30, sigLineY).strokeColor(getColor('#0000ff', isColorPage)).lineWidth(0.5).stroke();
      doc.fillColor(getColor('#0000ff', isColorPage)).fontSize(12).font('Helvetica-Bold')
        .text('AUTHORIZED SIGNATURE', PW - MR - 160, sigLineY + 5, { width: 130, align: 'center' });
    };

    renderPage(true);  // Page 1: Color
    doc.addPage();
    renderPage(false); // Page 2: Black & White (Challan No in red)

    doc.end();
  } catch (err) {
    console.error('Error downloading challan PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

const downloadChallanSummaryPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { dateStart, dateEnd, search } = req.query;

    const filter = {};
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { partyName: re },
        { fabricName: re },
        { jobNo: re },
        { designNo: re },
        { colour: re },
      ];
    }

    const challans = await FabricChallan.find(filter).sort({ challanNo: -1 }).lean();

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fabric_Challan_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');

    // Header section with Logo (image already includes brand name)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 20, { width: 140 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC CHALLAN SUMMARY REPORT', 190, 25, { width: 375, align: 'right' });

    let periodStr = 'Period: All Time';
    if (cleanDateStart && cleanDateEnd) periodStr = `Period: ${cleanDateStart} to ${cleanDateEnd}`;
    else if (cleanDateStart) periodStr = `Period: From ${cleanDateStart}`;
    else if (cleanDateEnd) periodStr = `Period: Until ${cleanDateEnd}`;

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(periodStr, 190, 43, { width: 375, align: 'right' });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 190, 56, { width: 375, align: 'right' });

    doc.moveTo(30, 72).lineTo(565, 72).strokeColor('#ddd6fe').lineWidth(1.5).stroke();

    let y = 84;

    // Totals
    const totalChallans = challans.length;
    const totalMtr = challans.reduce((sum, c) => sum + (c.totalMtr || 0), 0);
    const totalTp = challans.reduce((sum, c) => sum + (c.totalTp || 0), 0);
    const totalPcs = challans.reduce((sum, c) => sum + (c.pcs || 0), 0);

    // KPI Cards with Light Purple background & Black numbers
    doc.rect(30, y, 125, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL CHALLANS', 35, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(totalChallans), 35, y + 20);

    doc.rect(165, y, 125, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL ROLLS / TPS', 170, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(totalTp), 170, y + 20);

    doc.rect(300, y, 135, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL DISPATCHED (M)', 305, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalMtr.toLocaleString('en-IN')} m`, 305, y + 20);

    doc.rect(445, y, 120, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('EXPECTED PCS', 450, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(totalPcs), 450, y + 20);

    y += 52;

    const renderTableHeader = (currY) => {
      doc.rect(30, currY, 535, 20).fill('#ede9fe');
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('CHALLAN NO.', 35, currY + 6);
      doc.text('DATE', 105, currY + 6);
      doc.text('PARTY NAME', 170, currY + 6);
      doc.text('FABRIC & PANNA', 260, currY + 6);
      doc.text('JOB & DESIGN', 370, currY + 6);
      doc.text('TPS', 465, currY + 6);
      doc.text('TOTAL MTR', 510, currY + 6);
    };

    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('FABRIC CHALLANS MASTER LIST', 30, y);
    y += 14;

    renderTableHeader(y);
    y += 20;

    challans.forEach((c, i) => {
      if (y > 750) {
        doc.addPage();
        y = 30;
        renderTableHeader(y);
        y += 20;
      }
      const dt = c.date ? new Date(c.date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
      const fabStr = `${c.fabricName || '—'}${c.panna ? ' (' + c.panna + '")' : ''}`;
      const jobDesStr = `${c.jobNo || '—'} / ${c.designNo || '—'}`;

      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#fcfaff' : '#ffffff');
      doc.fillColor('#000000').fontSize(8).font('Helvetica');
      doc.text(`EDP-${c.challanNo}`, 35, y + 5);
      doc.text(dt, 105, y + 5);
      doc.text(c.partyName || '—', 170, y + 5, { width: 85, lineBreak: false });
      doc.text(fabStr, 260, y + 5, { width: 105, lineBreak: false });
      doc.text(jobDesStr, 370, y + 5, { width: 90, lineBreak: false });
      doc.text(String(c.totalTp || 0), 465, y + 5);
      doc.text(`${(c.totalMtr || 0).toLocaleString('en-IN')} m`, 510, y + 5);
      y += 18;
    });

    if (challans.length === 0) {
      doc.rect(30, y, 535, 25).fill('#fcfaff');
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('No fabric challan records found for selected period.', 30, y + 7, { width: 535, align: 'center' });
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Fabric Challan Report`, 30, 795, { width: 535, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Fabric Challan PDF report:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  createChallan,
  getChallans,
  updateChallan,
  deleteChallan,
  resetAllChallans,
  getNextChallanNo,
  getLotInfo,
  downloadChallanPdf,
  downloadChallanSummaryPdf,
};

