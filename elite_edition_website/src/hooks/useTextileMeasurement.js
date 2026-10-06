import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { calculateTextileYield, findFabricPreset } from '../utils/textileCalculation';

/**
 * useTextileMeasurement
 * Reusable hook providing textile yield, shrinkage, and piece calculation state
 * with automatic fallback to offline deterministic calculation engine.
 */
export function useTextileMeasurement(initialConfig = {}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const calculate = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    const merged = {
      inputMeters: Number(params.inputMeters ?? initialConfig.inputMeters ?? 100),
      fabricQuality: params.fabricQuality || initialConfig.fabricQuality || 'French Crepe',
      panna: params.panna || initialConfig.panna || '58"',
      garmentType: params.garmentType || initialConfig.garmentType || 'Kurti',
      customPieceMeters: params.customPieceMeters ? Number(params.customPieceMeters) : null,
      costPerMeter: params.costPerMeter ? Number(params.costPerMeter) : null,
      shrinkageOverride: params.shrinkageOverride !== undefined ? params.shrinkageOverride : null,
      userPrompt: params.userPrompt || ''
    };

    try {
      // 1. Try remote AI endpoint
      const res = await api.calculateAiMeasurement({
        inputMeters: merged.inputMeters,
        fabricQuality: merged.fabricQuality,
        panna: merged.panna,
        garmentType: merged.garmentType,
        customPieceMeters: merged.customPieceMeters,
        costPerMeter: merged.costPerMeter,
        userPrompt: merged.userPrompt
      });

      if (res && res.calculation) {
        setResult(res.calculation);
        return res.calculation;
      }
    } catch (err) {
      console.warn('Remote AI Measurement unavailable, falling back to local domain calculation engine:', err.message);
    }

    // 2. Deterministic client-side domain calculation fallback
    try {
      const fallbackResult = calculateTextileYield(merged);
      setResult(fallbackResult);
      return fallbackResult;
    } catch (calcErr) {
      setError(calcErr.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [initialConfig]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    loading,
    result,
    error,
    calculate,
    reset,
    setResult
  };
}
