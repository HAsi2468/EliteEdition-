/**
 * Central Master Screen & Inter-Department Communication Registry
 * 
 * Adding any new screen to AVAILABLE_SCREENS here will automatically:
 * 1. Populate in Admin Panel user screen checkboxes.
 * 2. Auto-assign permissions to Admin roles.
 * 3. Register a dynamic channel in Inter-Department Communication & Activity Stream.
 */

export const AVAILABLE_SCREENS = [
  // General & Core
  { id: 'dashboard', label: 'Dashboard Overview', category: 'General' },
  { id: 'workspace', label: 'Workspace / Chat', category: 'General' },
  { id: 'reports', label: 'Reports Center', category: 'General' },
  { id: 'unicommerce', label: 'Uniware Integrations', category: 'General' },
  { id: 'myntra', label: 'Myntra Integrations', category: 'General' },
  { id: 'admin', label: 'Admin User & Infrastructure Settings', category: 'General' },

  // Elite Edition (E-Commerce)
  { id: 'elite_online', label: 'Elite Online: Dashboard', category: 'Elite Edition' },
  { id: 'inventory', label: 'Elite Online: Store Inventory', category: 'Elite Edition' },
  { id: 'catalog', label: 'Elite Online: Product Catalog', category: 'Elite Edition' },
  { id: 'returns', label: 'Elite Online: Returns Department', category: 'Elite Edition' },
  { id: 'sales', label: 'Elite Online: Sales Orders', category: 'Elite Edition' },

  // Elite Digital Print
  { id: 'jobcards', label: 'Elite Prints: Dashboard', category: 'Elite Digital Print' },
  { id: 'jobcards_list', label: 'Elite Prints: Job Card', category: 'Elite Digital Print' },
  { id: 'jobcards_catalogue', label: 'Elite Prints: Design Catalog', category: 'Elite Digital Print' },
  { id: 'jobcards_tracking', label: 'Elite Prints: Job Card Tracking', category: 'Elite Digital Print' },
  { id: 'jobcards_printing_log', label: 'Elite Prints: Printing Department', category: 'Elite Digital Print' },
  { id: 'jobcards_master', label: 'Elite Prints: Design Master (100 Pic)', category: 'Elite Digital Print' },
  { id: 'jobcards_fabric', label: 'Elite Prints: Fabric Management', category: 'Elite Digital Print' },
  { id: 'jobcards_raw_materials', label: 'Elite Prints: Raw Materials', category: 'Elite Digital Print' },
  { id: 'jobcards_billing', label: 'Elite Prints: Billing & Invoicing (General)', category: 'Elite Digital Print' },
  { id: 'jobcards_billing_elite', label: 'Elite Prints: Elite Edition Billing', category: 'Elite Digital Print' },
  { id: 'jobcards_billing_fabtex', label: 'Elite Prints: Elite Fabtex Billing', category: 'Elite Digital Print' },
  { id: 'complaint_dashboard', label: 'Elite Prints: Complaint Dashboard (View Only)', category: 'Elite Digital Print' },
  { id: 'complaint_create', label: 'Elite Prints: Log New Complaint (Create Access)', category: 'Elite Digital Print' },
  { id: 'expense_dashboard', label: 'Elite Prints: Department Expenses (View Only)', category: 'Elite Digital Print' },
  { id: 'expense_create', label: 'Elite Prints: Log Department Expense (IN/OUT)', category: 'Elite Digital Print' },
  { id: 'jobcards_settings', label: 'Elite Prints: Settings', category: 'Elite Digital Print' },

  // Elite Stitching
  { id: 'stitching_jobcards', label: 'Elite Stitching: Job Card Tracking', category: 'Elite Stitching' },
  { id: 'stitching_design', label: 'Elite Stitching: Design Room', category: 'Elite Stitching' },
  { id: 'stitching_fabric', label: 'Elite Stitching: Fabric Challans', category: 'Elite Stitching' },
  { id: 'stitching_settings', label: 'Elite Stitching: Settings', category: 'Elite Stitching' },
];

export const SCREEN_GROUPS = {
  jobcards: {
    id: 'jobcards',
    name: '[EDP] Job Cards',
    deptShort: 'EDP',
    screenName: 'Job Cards',
    permissionKeys: ['jobcards', 'jobcards_list', 'stitching_jobcards'],
    description: 'Digital Printing & Production Job Cards Group'
  },
  jobcards_fabric: {
    id: 'jobcards_fabric',
    name: '[EDP] Fabric Inventory',
    deptShort: 'EDP',
    screenName: 'Fabric Inventory',
    permissionKeys: ['jobcards_fabric', 'jobcards_stitching_challan', 'stitching_fabric'],
    description: 'Fabric Inward, Outward & Dispatch Challans Group'
  },
  jobcards_billing: {
    id: 'jobcards_billing',
    name: '[EDP] Billing & Invoicing',
    deptShort: 'EDP',
    screenName: 'Billing & Invoicing',
    permissionKeys: ['jobcards_billing', 'jobcards_billing_elite', 'jobcards_billing_fabtex', 'invoices'],
    description: 'GST Invoicing, Accounts & Receivables Group'
  },
  jobcards_billing_elite: {
    id: 'jobcards_billing_elite',
    name: '[EDP] Elite Edition Billing',
    deptShort: 'EDP',
    screenName: 'Elite Edition Billing',
    permissionKeys: ['jobcards_billing_elite', 'jobcards_billing'],
    description: 'Elite Edition GST Billing & Invoicing Channel'
  },
  jobcards_billing_fabtex: {
    id: 'jobcards_billing_fabtex',
    name: '[EDP] Elite Fabtex Billing',
    deptShort: 'EDP',
    screenName: 'Elite Fabtex Billing',
    permissionKeys: ['jobcards_billing_fabtex'],
    description: 'Elite Fabtex GST Billing & Invoicing Channel'
  },
  jobcards_catalogue: {
    id: 'jobcards_catalogue',
    name: '[EDP] Design Room',
    deptShort: 'EDP',
    screenName: 'Design Room',
    permissionKeys: ['jobcards_catalogue', 'stitching_design'],
    description: 'Design Library, Master Assets & Patterns Group'
  },
  stitching_department: {
    id: 'stitching_department',
    name: '[ST] Stitching Department',
    deptShort: 'ST',
    screenName: 'Stitching Department',
    permissionKeys: ['stitching_jobcards', 'stitching_fabric', 'stitching_design'],
    description: 'Stitching Production & Fabric Challans Group'
  },
  inventory: {
    id: 'inventory',
    name: '[EE] E-Commerce Inventory',
    deptShort: 'EE',
    screenName: 'E-Commerce Inventory',
    permissionKeys: ['inventory', 'catalog', 'sales'],
    description: 'Elite Edition Online Inventory & Dispatch Group'
  }
};

/**
 * Helper to dynamically fetch or generate screen group definition
 */
export const getDynamicScreenGroup = (screenId) => {
  if (SCREEN_GROUPS[screenId]) {
    return SCREEN_GROUPS[screenId];
  }

  const foundScreen = AVAILABLE_SCREENS.find(s => s.id === screenId);
  const label = foundScreen ? foundScreen.label : screenId;
  const category = foundScreen ? foundScreen.category : 'General';
  const prefix = category === 'Elite Digital Print' ? '[EDP]' : category === 'Elite Stitching' ? '[ST]' : category === 'Elite Edition' ? '[EE]' : '[SYS]';

  return {
    id: screenId,
    name: `${prefix} ${label}`,
    deptShort: prefix.replace(/[^A-Z]/g, '') || 'SYS',
    screenName: label,
    permissionKeys: [screenId],
    description: `${label} Operations & Activity Stream Group`
  };
};
