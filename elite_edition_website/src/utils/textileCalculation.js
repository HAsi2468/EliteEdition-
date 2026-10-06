/**
 * textileCalculation.js
 * Domain calculation engine for textile printing, sublimation fusing shrinkage,
 * trimming loss, and garment piece yields.
 */

export const FABRIC_PRESETS = [
  { name: 'French Crepe', panna: '58"', temp: 210, speed: 80, shrinkage: 3.5, category: 'Poly Crepe' },
  { name: 'Poly Crepe', panna: '58"', temp: 210, speed: 80, shrinkage: 3.5, category: 'Poly Crepe' },
  { name: 'Georgette', panna: '44"', temp: 200, speed: 80, shrinkage: 4.0, category: 'Lightweight Georgette' },
  { name: 'Chiffon', panna: '44"', temp: 200, speed: 80, shrinkage: 4.0, category: 'Lightweight Chiffon' },
  { name: 'Organza', panna: '58"', temp: 195, speed: 80, shrinkage: 1.8, category: 'Sheer Organza' },
  { name: 'Satin', panna: '58"', temp: 205, speed: 80, shrinkage: 2.2, category: 'High-Gloss Satin' },
  { name: 'Poly Rayon', panna: '44"', temp: 190, speed: 76, shrinkage: 5.2, category: 'Cellulosic / Poly Rayon' },
  { name: 'Kohinoor Linen', panna: '58"', temp: 200, speed: 78, shrinkage: 4.5, category: 'Kohinoor Linen Blend' },
  { name: 'Heavy Velvet', panna: '58"', temp: 205, speed: 70, shrinkage: 3.0, category: 'Heavy Velvet Pile' },
  { name: 'Polly Mal', panna: '58"', temp: 205, speed: 80, shrinkage: 3.0, category: 'Poly Mal' },
  { name: 'Cambric', panna: '58"', temp: 200, speed: 78, shrinkage: 3.8, category: 'Cambric Base' }
];

export const GARMENT_PRESETS = [
  { id: 'Kurti', label: 'Kurti (1.75m @ 58" / 2.25m @ 44")', default58: 1.75, default44: 2.25 },
  { id: 'Saree', label: 'Saree (5.5m)', default58: 5.50, default44: 5.50 },
  { id: 'Dupatta', label: 'Dupatta (2.4m)', default58: 2.40, default44: 2.40 },
  { id: 'Gown', label: 'Gown / Anarkali (3.0m @ 58" / 3.75m @ 44")', default58: 3.00, default44: 3.75 },
  { id: 'Top', label: 'Top / Tunic (1.35m @ 58" / 1.75m @ 44")', default58: 1.35, default44: 1.75 },
  { id: 'Co-ord', label: 'Co-ord Set (3.2m @ 58" / 4.0m @ 44")', default58: 3.20, default44: 4.00 },
  { id: 'Custom', label: 'Custom Piece Length', default58: 2.00, default44: 2.00 },
];

/**
 * Finds the closest matching fabric preset.
 */
export function findFabricPreset(fabricName) {
  if (!fabricName) return FABRIC_PRESETS[0];
  const query = String(fabricName).trim().toLowerCase();
  const direct = FABRIC_PRESETS.find(p => p.name.toLowerCase() === query);
  if (direct) return direct;

  const partial = FABRIC_PRESETS.find(p => query.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(query));
  if (partial) return partial;

  if (query.includes('crepe')) return FABRIC_PRESETS[0];
  if (query.includes('organza')) return FABRIC_PRESETS[4];
  if (query.includes('satin')) return FABRIC_PRESETS[5];
  if (query.includes('georgette')) return FABRIC_PRESETS[2];
  if (query.includes('rayon') || query.includes('viscose')) return FABRIC_PRESETS[6];
  if (query.includes('linen')) return FABRIC_PRESETS[7];
  if (query.includes('velvet')) return FABRIC_PRESETS[8];

  return { name: fabricName, panna: '58"', temp: 205, speed: 80, shrinkage: 3.0, category: 'Polyester Standard' };
}

/**
 * Calculates garment piece length required based on panna width.
 */
export function getPieceLengthForGarment(garmentType, pannaWidth, customLength = null) {
  if (customLength && Number(customLength) > 0) {
    return Number(customLength);
  }
  const pannaNum = parseInt(String(pannaWidth || '').replace(/\D/g, ''), 10) || 58;
  const preset = GARMENT_PRESETS.find(g => g.id.toLowerCase() === String(garmentType).toLowerCase());

  if (!preset) return 2.00;
  return pannaNum >= 56 ? preset.default58 : preset.default44;
}

/**
 * Pure calculation engine for textile measurements, shrinkage, and yield.
 *
 * @param {Object} params
 * @param {number|string} params.inputMeters - Raw meters entered
 * @param {string} [params.fabricQuality] - Fabric name
 * @param {string|number} [params.panna] - Fabric width in inches
 * @param {string} [params.garmentType] - Type of garment (Kurti, Saree, etc.)
 * @param {number} [params.customPieceMeters] - User specified length per piece
 * @param {number} [params.costPerMeter] - Cost per raw meter
 * @param {number} [params.shrinkageOverride] - Optional manual override of shrinkage %
 * @param {number} [params.trimLossPct] - Trimming allowance % (default 1.5%)
 * @returns {Object} Calculated yield metrics
 */
export function calculateTextileYield({
  inputMeters = 100,
  fabricQuality = 'French Crepe',
  panna = '58"',
  garmentType = 'Kurti',
  customPieceMeters = null,
  costPerMeter = null,
  shrinkageOverride = null,
  trimLossPct = 1.5
}) {
  const mIn = Math.max(0, Number(inputMeters) || 0);
  const pNum = parseInt(String(panna).replace(/\D/g, ''), 10) || 58;
  const pannaStr = `${pNum}"`;

  const preset = findFabricPreset(fabricQuality);
  const shrinkagePct = (shrinkageOverride !== null && shrinkageOverride !== undefined && !isNaN(shrinkageOverride))
    ? Number(shrinkageOverride)
    : preset.shrinkage;

  const shrinkMtr = Number(((mIn * shrinkagePct) / 100).toFixed(2));
  const trimMtr = Number(((mIn * trimLossPct) / 100).toFixed(2));
  const totalWaste = Number((shrinkMtr + trimMtr).toFixed(2));
  const netOut = Number(Math.max(0, mIn - totalWaste).toFixed(2));
  const efficiencyPct = mIn > 0 ? Number(((netOut / mIn) * 100).toFixed(1)) : 0;

  const pieceLength = getPieceLengthForGarment(garmentType, pNum, customPieceMeters);
  const pieces = pieceLength > 0 ? Math.floor(netOut / pieceLength) : 0;
  const remnantMtr = pieceLength > 0 ? Number((netOut - (pieces * pieceLength)).toFixed(2)) : 0;

  let costing = null;
  const rate = Number(costPerMeter);
  if (!isNaN(rate) && rate > 0) {
    const totalRawCost = Number((mIn * rate).toFixed(2));
    const effectiveCostPerFreshMtr = netOut > 0 ? Number((totalRawCost / netOut).toFixed(2)) : rate;
    const fabricCostPerPiece = pieces > 0 ? Number((totalRawCost / pieces).toFixed(2)) : 0;
    costing = {
      ratePerMtr: rate,
      totalRawCost,
      effectiveCostPerFreshMtr,
      fabricCostPerPiece
    };
  }

  const aiAdvice = `Calibrated with textile standards for ${preset.name} (${pannaStr}): Thermal sublimation shrinkage estimated at ${shrinkagePct}% plus ${trimLossPct}% trim allowance yields ~${netOut} fresh meters (~${pieces} ${garmentType} pieces). Recommended machine parameter: ${preset.temp}°C at ${preset.speed} m/min.`;

  return {
    inputMeters: mIn,
    fabric: fabricQuality,
    fabricCategory: preset.category || 'Polyester Standard',
    panna: pannaStr,
    recommendedTemp: `${preset.temp}°C`,
    recommendedSpeed: `${preset.speed} m/min`,
    shrinkagePct,
    trimLossPct,
    shrinkageMeters: shrinkMtr,
    trimmingMeters: trimMtr,
    totalWastageMeters: totalWaste,
    netOutputMeters: netOut,
    efficiencyPct,
    garmentType,
    pieceLengthMeters: pieceLength,
    expectedPieces: pieces,
    remnantMeters: remnantMtr,
    costing,
    aiAdvice
  };
}
