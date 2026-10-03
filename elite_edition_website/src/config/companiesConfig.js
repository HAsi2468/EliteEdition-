/**
 * Master Centralized Company Registry
 * Defines all 5 distinct corporate entities / workspaces across the platform.
 */

export const COMPANIES = [
  {
    id: 'elite_online',
    code: 'EON',
    name: 'EON',
    type: 'E-Commerce Store & Operations',
    iconName: 'Store',
    defaultTab: 'dashboard',
    badgeColor: '#6366f1',
    iconColor: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    description: 'EON store inventory, catalog, sales orders & return management.'
  },
  {
    id: 'digital_print',
    code: 'EDP',
    name: 'Elite Digital Print',
    type: 'Digital Textile Printing',
    iconName: 'Printer',
    defaultTab: 'jobcards',
    badgeColor: '#0284c7',
    iconColor: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    description: 'Job cards, printing logs, fabric inventory & production tracking.'
  },
  {
    id: 'stitching',
    code: 'ES',
    name: 'Elite Stitching',
    type: 'Garment Stitching & Manufacturing',
    iconName: 'Scissors',
    defaultTab: 'es_dashboard',
    badgeColor: '#10b981',
    iconColor: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    description: 'Stitching job cards, design room & stitching fabric challans.'
  },
  {
    id: 'elite_edition',
    code: 'EE',
    name: 'Elite Edition',
    type: 'Wholesale & Corporate Entity',
    iconName: 'Building',
    defaultTab: 'ee_invoices',
    badgeColor: '#8b5cf6',
    iconColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    description: 'Company workspace for wholesale billing and settings.'
  },
  {
    id: 'elite_fabtex',
    code: 'EF',
    name: 'Elite Fabtex',
    type: 'Fabric & Textile Sales Entity',
    iconName: 'Building',
    defaultTab: 'ef_invoices',
    badgeColor: '#f59e0b',
    iconColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: 'Company workspace for fabric billing and settings.'
  }
];

export const getCompanyById = (companyId) => {
  return COMPANIES.find(c => c.id === companyId) || COMPANIES[0];
};
