/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - MODEL LAYER: COMPANY MODEL
 * Standardizes company profile, statutory tax numbers, and brand theme tokens.
 * ============================================================================
 */

class CompanyModel {
  static BRAND_THEMES = {
    'elite digital print': { primary: '#1d4ed8', border: '#1d4ed8', tint: '#eff6ff', badgeText: '#1e40af' },
    'elite digital prints': { primary: '#1d4ed8', border: '#1d4ed8', tint: '#eff6ff', badgeText: '#1e40af' },
    'elite stitching': { primary: '#064e3b', border: '#064e3b', tint: '#ecfdf5', badgeText: '#065f46' },
    'ethnowear': { primary: '#8b5a2b', border: '#8b5a2b', tint: '#faf4ef', badgeText: '#704214' },
    'ethno wear': { primary: '#8b5a2b', border: '#8b5a2b', tint: '#faf4ef', badgeText: '#704214' },
    'elite ethnowear': { primary: '#8b5a2b', border: '#8b5a2b', tint: '#faf4ef', badgeText: '#704214' },
    'elite fabtex': { primary: '#d97706', border: '#d97706', tint: '#fffbeb', badgeText: '#b45309' },
    'sobise': { primary: '#e11d48', border: '#e11d48', tint: '#fff1f2', badgeText: '#be123c' },
    'yamunaji': { primary: '#581c87', border: '#581c87', tint: '#faf5ff', badgeText: '#6b21a8' },
    'elite edition': { primary: '#312e81', border: '#312e81', tint: '#eef2ff', badgeText: '#3730a3' },
    'elite online': { primary: '#1e3a8a', border: '#1e3a8a', tint: '#f0f9ff', badgeText: '#0369a1' },
    'exedp': { primary: '#1e293b', border: '#1e293b', tint: '#f8fafc', badgeText: '#334155' }
  };

  constructor(data = {}) {
    this.entity = String(data.companyEntity || data.entity || 'Elite Digital Print').trim();
    this.name = String(data.companyName || data.name || this.entity).toUpperCase();
    this.address = data.companyAddress || data.address || '';
    this.gstin = data.companyGstin || data.gstin || '';
    this.pan = data.companyPan || data.pan || '';
    this.phone = data.companyPhone || data.phone || '';
    this.email = data.companyEmail || data.email || '';
    this.state = data.companyState || data.state || 'Gujarat';
    this.stateCode = String(data.companyStateCode || data.stateCode || '24');
    
    // Bank account credentials
    this.bankName = data.bankName || 'KOTAK MAHINDRA BANK';
    this.bankAccount = data.bankAccount || data.accountNo || '';
    this.bankIfsc = data.bankIfsc || data.ifsc || '';
    this.bankBranch = data.bankBranch || 'RING ROAD, SURAT';
    
    // Brand visual theme tokens
    const key = this.entity.toLowerCase();
    this.theme = CompanyModel.BRAND_THEMES[key] || CompanyModel.BRAND_THEMES['elite digital print'];
  }
}

module.exports = CompanyModel;
