/**
 * Master Centralized Company Registry (Frontend)
 * Defines all 7 distinct corporate entities / workspaces across the platform.
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
    invoicesTab: 'billing',
    settingsTab: 'company_settings',
    invoicePrefix: 'EDP-2627-',
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
    invoicesTab: 'es_dashboard',
    settingsTab: 'es_settings',
    invoicePrefix: 'ES-2627-',
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
    invoicesTab: 'ee_invoices',
    settingsTab: 'ee_settings',
    invoicePrefix: 'EE-2627-',
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
    invoicesTab: 'ef_invoices',
    settingsTab: 'ef_settings',
    invoicePrefix: 'EF-2627-',
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
    invoicesTab: 'sales',
    settingsTab: 'eo_settings',
    invoicePrefix: 'EON-2627-',
    badgeColor: '#6366f1',
    iconColor: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    description: 'E-commerce store inventory, catalog, sales orders & return management.',
    aliases: ['elite_online', 'eon', 'elite online', 'elite online store', 'store', 'e-commerce']
  },
  {
    id: 'sobise',
    code: 'SO',
    name: 'Sobise',
    fullName: 'Sobise',
    shortName: 'Sobise',
    type: 'Fashion & Corporate Entity',
    iconName: 'Building',
    defaultTab: 'so_invoices',
    invoicesTab: 'so_invoices',
    settingsTab: 'so_settings',
    invoicePrefix: 'SO-2627-',
    badgeColor: '#e11d48',
    iconColor: '#e11d48',
    gradient: 'linear-gradient(135deg, #f43f5e, #be123c)',
    description: 'Company workspace for Sobise finance, complaints & settings.',
    aliases: ['sobise', 'so', 'sobise entity']
  },
  {
    id: 'ethno_wear',
    code: 'EW',
    name: 'Ethno wear',
    fullName: 'Ethno wear',
    shortName: 'Ethno wear',
    type: 'Ethnic Wear & Apparel Brand',
    iconName: 'Sparkles',
    defaultTab: 'ew_invoices',
    invoicesTab: 'ew_invoices',
    settingsTab: 'ew_settings',
    invoicePrefix: 'EW-2627-',
    badgeColor: '#ec4899',
    iconColor: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
    description: 'Company workspace for Ethno wear finance, invoices & billing.',
    aliases: ['ethno_wear', 'ew', 'ethno wear', 'ethnowear', 'ethno']
  },
  {
    id: 'yamunaji',
    code: 'YJ',
    name: 'Yamunaji',
    fullName: 'Yamunaji',
    shortName: 'Yamunaji',
    type: 'Textile & Corporate Sales Entity',
    iconName: 'Building',
    defaultTab: 'yj_invoices',
    invoicesTab: 'yj_invoices',
    settingsTab: 'yj_settings',
    invoicePrefix: 'YJ-2627-',
    badgeColor: '#0ea5e9',
    iconColor: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    description: 'Company workspace for Yamunaji finance, invoices & billing.',
    aliases: ['yamunaji', 'yj', 'yamuna ji', 'yamuna']
  }
];

/**
 * Normalizes any company code, name, legacy id, or alias to canonical company id
 */
export const normalizeCompanyId = (input) => {
  if (!input) return 'digital_print';
  if (typeof input === 'object') {
    input = input.id || input.companyId || input.company_id || input.code || input.companyCode || input.name || '';
  }
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
