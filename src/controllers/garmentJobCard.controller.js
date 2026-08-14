const db = require('../db/models');
const logger = require('../config/logger');

const recalculateCard = (body) => {
  const sr = body.size_ratios || {};
  const totalPieces = (Number(sr.xs_34) || 0) +
                      (Number(sr.s_36) || 0) +
                      (Number(sr.m_38) || 0) +
                      (Number(sr.l_40) || 0) +
                      (Number(sr.xl_42) || 0) +
                      (Number(sr.xl2_44) || 0) +
                      (Number(sr.xl3_46) || 0) +
                      (Number(sr.xl4_48) || 0) +
                      (Number(sr.xl5_50) || 0) +
                      (Number(sr.xl6_52) || 0);

  body.total_pieces = totalPieces;

  let totalFabric = 0;
  if (Array.isArray(body.fabric_details)) {
    body.fabric_details = body.fabric_details.map(f => {
      const rate = Number(f.rate_per_unit) || 0;
      const cons = Number(f.consumption) || 0;
      const pQty = Number(f.purchase_qty) || 0;
      const ratePc = rate * cons;
      let amt = pQty > 0 ? (pQty * rate) : (totalPieces * ratePc);
      if (!amt && f.amount) amt = Number(f.amount) || 0;
      totalFabric += amt;
      return { ...f, rate_per_pc: Number(ratePc.toFixed(2)), amount: Number(amt.toFixed(2)) };
    });
  }

  let totalStitching = 0;
  if (Array.isArray(body.vendor_details)) {
    body.vendor_details = body.vendor_details.map(v => {
      const rate = Number(v.rate) || 0;
      const qty = Number(v.quantity) || totalPieces;
      const amt = rate * qty;
      totalStitching += amt;
      return { ...v, quantity: qty, amount: Number(amt.toFixed(2)) };
    });
  }

  const overhead = Number(body.overhead_cost) || 0;
  const grandTotal = totalFabric + totalStitching + overhead;
  const finalCostPerPc = totalPieces > 0 ? (grandTotal / totalPieces) : 0;

  body.total_fabric_cost = Number(totalFabric.toFixed(2));
  body.total_stitching_cost = Number(totalStitching.toFixed(2));
  body.overhead_cost = Number(overhead.toFixed(2));
  body.grand_total_cost = Number(grandTotal.toFixed(2));
  body.final_cost_per_pc = Number(finalCostPerPc.toFixed(2));

  return body;
};

const STAGES = [
  { stage_number: 1, key: '1_fabric_order', name: 'Fabric Order', icon: '🧵' },
  { stage_number: 2, key: '2_fabric_checking', name: 'Fabric Checking', icon: '🔍' },
  { stage_number: 3, key: '3_cutting', name: 'Cutting', icon: '✂️' },
  { stage_number: 4, key: '4_stitching', name: 'Stitching', icon: '🪡' },
  { stage_number: 5, key: '5_garment_checking', name: 'Garment Checking', icon: '🔎' },
  { stage_number: 6, key: '6_press_and_pack', name: 'Press & Pack', icon: '📦' },
  { stage_number: 7, key: '7_in_rack', name: 'In Rack', icon: '🗄️' },
  { stage_number: 8, key: '8_delivery', name: 'Delivery', icon: '🚚' }
];

const getAll = async (req, res) => {
  try {
    const { dateStart, dateEnd, design_number, label, vendor_name, search, status, stage, page = 1, limit = 50 } = req.query;
    const filter = { department: 'stitching' };

    if (status && status !== 'All') filter.status = status;
    if (stage && stage !== 'All') filter.current_stage = Number(stage);
    if (design_number) filter.design_number = { $regex: design_number, $options: 'i' };
    if (label) filter.label = { $regex: label, $options: 'i' };
    if (vendor_name) {
      filter['vendor_details.vendor_name'] = { $regex: vendor_name, $options: 'i' };
    }

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }

    if (search) {
      filter.$or = [
        { job_number: { $regex: search, $options: 'i' } },
        { design_number: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } },
        { finishing: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      db.GarmentJobCard.find(filter).sort({ created_at: -1 }).skip(skip).limit(Number(limit)).lean(),
      db.GarmentJobCard.countDocuments(filter)
    ]);

    res.json({ success: true, data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    logger.error('garmentJobCard.getAll error: %o', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch garment job cards' });
  }
};

const getOne = async (req, res) => {
  try {
    const card = await db.GarmentJobCard.findById(req.params.id).lean();
    if (!card) return res.status(404).json({ success: false, error: 'Garment job card not found' });
    res.json({ success: true, data: card });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = recalculateCard({ ...req.body });
    if (!payload.current_stage) {
      payload.current_stage = 1;
      payload.current_stage_name = 'Fabric Order';
    }
    const card = await db.GarmentJobCard.create(payload);
    res.status(201).json({ success: true, data: card });
  } catch (err) {
    logger.error('garmentJobCard.create error: %o', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: `Job Number "${req.body.job_number}" already exists.` });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to create garment job card' });
  }
};

const update = async (req, res) => {
  try {
    const payload = recalculateCard({ ...req.body });
    const card = await db.GarmentJobCard.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!card) return res.status(404).json({ success: false, error: 'Garment job card not found' });
    res.json({ success: true, data: card });
  } catch (err) {
    logger.error('garmentJobCard.update error: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const advanceStage = async (req, res) => {
  try {
    const card = await db.GarmentJobCard.findById(req.params.id);
    if (!card) return res.status(404).json({ success: false, error: 'Garment job card not found' });

    const currentStageNo = card.current_stage || 1;
    const nextStageNo = Math.min(currentStageNo + 1, 8);
    const fromStage = STAGES.find(s => s.stage_number === currentStageNo) || STAGES[0];
    const targetStage = STAGES.find(s => s.stage_number === nextStageNo) || STAGES[nextStageNo - 1];

    const {
      pcs_completed = card.total_pieces || 0,
      defect_pcs = 0,
      operator_name = '',
      rack_number = '',
      remarks = '',
      user_name = 'Operator'
    } = req.body;

    const transitionLog = {
      stage_number: targetStage.stage_number,
      stage_name: targetStage.name,
      from_stage_name: fromStage.name,
      pcs_completed: Number(pcs_completed) || 0,
      defect_pcs: Number(defect_pcs) || 0,
      operator_name: operator_name.trim(),
      rack_number: rack_number.trim(),
      remarks: remarks.trim(),
      transitioned_at: new Date(),
      transitioned_by: user_name
    };

    card.current_stage = targetStage.stage_number;
    card.current_stage_name = targetStage.name;
    if (targetStage.stage_number > 1 && card.status === 'Pending') {
      card.status = 'In Production';
    }
    if (targetStage.stage_number === 8) {
      card.status = 'Completed';
    }

    if (!Array.isArray(card.stage_history)) card.stage_history = [];
    card.stage_history.push(transitionLog);

    await card.save();

    // Broadcast event to [ST] Stitching Department chat group
    try {
      const stitchingRoom = await db.ChatRoom.findOne({ name: '[ST] Stitching Department' });
      if (stitchingRoom) {
        const msgText = `✂️ **Stitching Job Card Stage Update**\n\n` +
          `📋 **Job Card**: #${card.job_number} (Design: ${card.design_number || 'N/A'})\n` +
          `🔄 **Stage Shifted**: ${fromStage.icon} ${fromStage.name} ➡️ **${targetStage.icon} ${targetStage.name}**\n` +
          `👕 **Passed Pcs**: ${pcs_completed} pcs | ⚠️ **Defects**: ${defect_pcs} pcs\n` +
          (operator_name ? `👤 **Operator**: ${operator_name}\n` : '') +
          (rack_number ? `🗄️ **Rack Location**: ${rack_number}\n` : '') +
          `👤 **Updated By**: ${user_name}`;

        const adminUser = await db.user.findOne({ role: 'admin' }) || { _id: new (require('mongoose').Types.ObjectId)() };
        await db.ChatMessage.create({
          roomId: stitchingRoom._id,
          senderId: adminUser._id,
          content: msgText,
          type: 'text'
        });
      }
    } catch (msgErr) {
      logger.warn('Failed to post stage transition message: %o', msgErr);
    }

    res.json({ success: true, data: card, message: `Advanced to Stage ${targetStage.stage_number}: ${targetStage.name}` });
  } catch (err) {
    logger.error('garmentJobCard.advanceStage error: %o', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to advance stage' });
  }
};

const remove = async (req, res) => {
  try {
    const card = await db.GarmentJobCard.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ success: false, error: 'Garment job card not found' });
    res.json({ success: true, message: 'Garment job card deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getNextJobNumber = async (req, res) => {
  try {
    const cards = await db.GarmentJobCard.find({}, { job_number: 1 }).lean();
    let maxNo = 1000;
    cards.forEach(c => {
      if (!c.job_number) return;
      const m = String(c.job_number).match(/(\d+)/);
      if (m) {
        const num = Number(m[1]);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });
    res.json({ success: true, nextJobNumber: `GJC-${maxNo + 1}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getAnalyticsSummary = async (req, res) => {
  try {
    const { dateStart, dateEnd, design_number, label } = req.query;
    const filter = { department: 'stitching' };

    if (design_number) filter.design_number = { $regex: design_number, $options: 'i' };
    if (label) filter.label = { $regex: label, $options: 'i' };
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }

    const cards = await db.GarmentJobCard.find(filter).lean();

    let totalJobs = cards.length;
    let totalPieces = 0;
    let totalFabricCost = 0;
    let totalStitchingCost = 0;
    let grandTotalCost = 0;

    const designMap = {};

    cards.forEach(c => {
      const pcs = Number(c.total_pieces) || 0;
      const fCost = Number(c.total_fabric_cost) || 0;
      const sCost = Number(c.total_stitching_cost) || 0;
      const gCost = Number(c.grand_total_cost) || 0;

      totalPieces += pcs;
      totalFabricCost += fCost;
      totalStitchingCost += sCost;
      grandTotalCost += gCost;

      const dKey = c.design_number || 'Unspecified';
      if (!designMap[dKey]) {
        designMap[dKey] = { design_number: dKey, job_count: 0, total_pcs: 0, total_cost: 0 };
      }
      designMap[dKey].job_count += 1;
      designMap[dKey].total_pcs += pcs;
      designMap[dKey].total_cost += gCost;
    });

    const designAnalytics = Object.values(designMap).map(d => ({
      ...d,
      avg_cost_per_pc: d.total_pcs > 0 ? Number((d.total_cost / d.total_pcs).toFixed(2)) : 0
    }));

    const avgCostPerPiece = totalPieces > 0 ? Number((grandTotalCost / totalPieces).toFixed(2)) : 0;

    res.json({
      success: true,
      summary: {
        totalJobs,
        totalPieces,
        totalFabricCost: Number(totalFabricCost.toFixed(2)),
        totalStitchingCost: Number(totalStitchingCost.toFixed(2)),
        grandTotalCost: Number(grandTotalCost.toFixed(2)),
        avgCostPerPiece
      },
      designAnalytics
    });
  } catch (err) {
    logger.error('garmentJobCard.getAnalyticsSummary error: %o', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  advanceStage,
  remove,
  getNextJobNumber,
  getAnalyticsSummary
};
