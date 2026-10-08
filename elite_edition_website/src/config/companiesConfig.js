/**
 * Master Centralized Company Registry (Frontend)
 * Defines all 5 distinct corporate entities / workspaces across the platform.
 */

export const COMPANIES = [
  {
    id: 'digital_print',
    code: 'EDP',
    name: 'Elite Digital Prints',
    fullName: 'Elite Digital Prints',
    shortName: 'Digital Print',
    type: 'Digital Textile Printing',
    iconName: 'Printer',
    defaultTab: 'jobcards',
    badgeColor: '#0284c7',
    iconColor: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    description: 'Job cards, printing logs, fabric inventory & production tracking.',
    aliases: ['digital_print', 'digital_prints', 'edp', 'elite digital print', 'elite digital prints', 'digital print', 'printing']
  },
  {
    id: 'stitching',
    code: 'ES',
    name: 'Elite Stitching',
    fullName: 'Elite Stitching',
    shortName: 'Stitching',
    type: 'Garment Stitching & Manufacturing',
    iconName: 'Scissors',
    defaultTab: 'es_dashboard',
    badgeColor: '#10b981',
    iconColor: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    description: 'Stitching job cards, design room & stitching fabric challans.',
    aliases: ['stitching', 'es', 'elite stitching', 'garment stitching', 'garment_job_card']
  },
  {
    id: 'elite_edition',
    code: 'EE',
    name: 'Elite Edition',
    fullName: 'Elite Edition',
    shortName: 'Elite Edition',
    type: 'Wholesale & Corporate Entity',
    iconName: 'Building',
    defaultTab: 'ee_invoices',
    badgeColor: '#8b5cf6',
    iconColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    description: 'Company workspace for wholesale billing and settings.',
    aliases: ['elite_edition', 'ee', 'elite edition', 'wholesale']
  },
  {
    id: 'elite_fabtex',
    code: 'EF',
    name: 'Elite Fabtex',
    fullName: 'Elite Fabtex',
    shortName: 'Fabtex',
    type: 'Fabric & Textile Sales Entity',
    iconName: 'Layers',
    defaultTab: 'ef_invoices',
    badgeColor: '#f59e0b',
    iconColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: 'Company workspace for fabric billing and settings.',
    aliases: ['elite_fabtex', 'ef', 'elite fabtex', 'fabtex', 'fabric']
  },
  {
    id: 'elite_online',
    code: 'EON',
    name: 'Elite Online',
    fullName: 'Elite Online (EON)',
    shortName: 'Elite Online',
    type: 'E-Commerce Store & Operations',
    iconName: 'Store',
    defaultTab: 'dashboard',
    badgeColor: '#6366f1',
    iconColor: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    description: 'E-commerce store inventory, catalog, sales orders & return management.',
    aliases: ['elite_online', 'eon', 'elite online', 'elite online store', 'store', 'e-commerce']
  }
];

/**
 * Normalizes any company code, name, legacy id, or alias to canonical company id
 */
export const normalizeCompanyId = (input) => {
  if (!input) return 'digital_print';
  const raw = String(input).trim();
  const lower = raw.toLowerCase();
  const clean = lower.replace(/[\s_-]+/g, '_');

  for (const c of COMPANIES) {
    if (
      c.id === clean ||
      c.code.toLowerCase() === lower ||
      c.name.toLowerCase() === lower ||
      c.name.toLowerCase().replace(/[\s_-]+/g, '_') === clean ||
      (c.aliases && c.aliases.some(a => a.toLowerCase() === lower || a.toLowerCase().replace(/[\s_-]+/g, '_') === clean))
    ) {
      return c.id;
    }
  }

  // Fallback substring checks
  for (const c of COMPANIES) {
    if (lower.includes(c.id) || lower.includes(c.code.toLowerCase()) || lower.includes(c.name.toLowerCase())) {
      return c.id;
    }
  }

  return 'digital_print';
};

/**
 * Robust company lookup guaranteeing safe match across codes, names, or IDs.
 * Always safely defaults to Elite Digital Prints (flagship entity) instead of EON.
 */
export const getCompanyById = (companyId) => {
  const normId = normalizeCompanyId(companyId);
  return COMPANIES.find(c => c.id === normId) || COMPANIES[0];
};

export default COMPANIES;
