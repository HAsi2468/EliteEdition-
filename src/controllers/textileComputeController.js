const textileComputeService = require('../services/textileComputeService');

/**
 * 1. Quick Header Preflight
 */
const quickInspect = async (req, res) => {
  try {
    const { fileUrl, jobTargetWidthInches, minRequiredDpi } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'fileUrl is required' });
    }
    const result = await textileComputeService.quickPreflightCheck(
      fileUrl,
      jobTargetWidthInches || 44.0,
      minRequiredDpi || 150
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 2. Full Kyocera KJ4B Droplet & Ink Cost Simulation
 */
const fullAnalysis = async (req, res) => {
  try {
    const { fileUrl, jobTargetWidthInches, jobTargetLengthMeters, inkCostRate, minRequiredDpi } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'fileUrl is required' });
    }
    const result = await textileComputeService.runFullCmykCostAnalysis(
      fileUrl,
      jobTargetWidthInches || 44.0,
      jobTargetLengthMeters || 100.0,
      inkCostRate || 1800.0
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 3. Health & Capabilities Check
 */
const getHealth = async (req, res) => {
  try {
    const health = await textileComputeService.checkEngineHealth();
    return res.status(200).json({ success: true, ...health });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  quickInspect,
  fullAnalysis,
  getHealth,
};
