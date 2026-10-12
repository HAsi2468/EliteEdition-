import { api } from './api';

export const textileComputeService = {
  /**
   * Sub-200ms quick preflight check
   */
  async quickInspect(fileUrl, jobTargetWidthInches = 44, minRequiredDpi = 150) {
    const res = await api.post('/v1/textile-compute/quick-inspect', {
      fileUrl,
      jobTargetWidthInches,
      minRequiredDpi,
    });
    return res.data;
  },

  /**
   * Full Kyocera KJ4B Droplet & CMYK coverage analysis
   */
  async fullAnalysis(fileUrl, jobTargetWidthInches = 44, jobTargetLengthMeters = 100, inkCostRate = 1800, minRequiredDpi = 150) {
    const res = await api.post('/v1/textile-compute/full-analysis', {
      fileUrl,
      jobTargetWidthInches,
      jobTargetLengthMeters,
      inkCostRate,
      minRequiredDpi,
    });
    return res.data;
  },

  /**
   * Engine health and hardware capabilities
   */
  async getHealth() {
    const res = await api.get('/v1/textile-compute/health');
    return res.data;
  },
};
