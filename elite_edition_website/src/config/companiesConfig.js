/**
 * Master Centralized Company Registry
 * Defines all 5 distinct corporate entities / workspaces across the platform.
 */

export const COMPANIES = [
  {
    id: 'elite_online',
    code: 'EO',
    name: 'Elite Online',
    type: 'E-Commerce Store & Operations',
    iconName: 'Store',
    defaultTab: 'dashboard',
    badgeColor: '#4f46e5',
    description: 'Online store inventory, catalog, sales orders & return management.'
  },
  {
    id: 'digital_print',
    code: 'EDP',
    name: 'Elite Digital Print',
    type: 'Digital Textile Printing',
    iconName: 'Printer',
    defaultTab: 'jobcards',
    badgeColor: '#4f46e5',
    description: 'Job cards, printing logs, fabric inventory & production tracking.'
  },
  {
    id: 'stitching',
    code: 'ES',
    name: 'Elite Stitching',
    type: 'Garment Stitching & Manufacturing',
    iconName: 'Scissors',
    defaultTab: 'es_dashboard',
    badgeColor: '#4f46e5',
    description: 'Stitching job cards, design room & stitching fabric challans.'
  },
  {
    id: 'elite_edition',
    code: 'EE',
    name: 'Elite Edition',
    type: 'Wholesale & Corporate Entity',
    iconName: 'Building',
    defaultTab: 'ee_invoices',
    badgeColor: '#4f46e5',
    description: 'Company workspace for wholesale billing and settings.'
  },
  {
    id: 'elite_fabtex',
    code: 'EF',
    name: 'Elite Fabtex',
    type: 'Fabric & Textile Sales Entity',
    iconName: 'Building',
    defaultTab: 'ef_invoices',
    badgeColor: '#4f46e5',
    description: 'Company workspace for fabric billing and settings.'
  }
];

export const getCompanyById = (companyId) => {
  return COMPANIES.find(c => c.id === companyId) || COMPANIES[0];
};
