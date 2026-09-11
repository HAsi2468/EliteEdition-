const { ChatRoom, user: User } = require('../db/models');

/**
 * Standard department authority group mappings based on permission prefixes
 */
const SYSTEM_COMMUNICATION_GROUPS = [
  {
    groupKey: 'edp__job_card',
    name: 'Elite Digital Print — Job Card Management',
    department: 'Production',
    companyEntity: 'Elite Digital Print',
    permissionScope: 'jobcards',
    description: 'Automated authority group for Job Card creation, status updates & production logs.'
  },
  {
    groupKey: 'edp__printing_log',
    name: 'Elite Digital Print — Printing Department Log',
    department: 'Production',
    companyEntity: 'Elite Digital Print',
    permissionScope: 'jobcards_printing_log',
    description: 'Real-time group for machine print logs, shift records & raw material entries.'
  },
  {
    groupKey: 'edp__fabric_inventory',
    name: 'Elite Digital Print — Fabric Inventory',
    department: 'Fabric',
    companyEntity: 'Elite Digital Print',
    permissionScope: 'jobcards_fabric',
    description: 'Fabric inward, stock adjustments, vendor challans & roll tracking group.'
  },
  {
    groupKey: 'edp__billing_invoicing',
    name: 'Elite Digital Print — Billing & Invoices',
    department: 'Billing',
    companyEntity: 'Elite Digital Print',
    permissionScope: 'jobcards_billing',
    description: 'GST invoice generation, payment receipts & customer billing updates.'
  },
  {
    groupKey: 'stitching__department',
    name: 'Elite Stitching — Stitching Department',
    department: 'Stitching',
    companyEntity: 'Elite Stitching',
    permissionScope: 'stitching',
    description: 'Garment job cards, stitching challans, design patterns & finishing updates.'
  },
  {
    groupKey: 'eo__sales_orders',
    name: 'Elite Online — Sales & Orders',
    department: 'E-Commerce',
    companyEntity: 'Elite Online',
    permissionScope: 'sales',
    description: 'Live order tracking, Unicommerce order syncs & e-commerce sales logs.'
  },
  {
    groupKey: 'eo__returns_manager',
    name: 'Elite Online — Returns Manager',
    department: 'E-Commerce',
    companyEntity: 'Elite Online',
    permissionScope: 'returns',
    description: 'RTO claims, customer returns, quality inspects & refund tracking.'
  },
  {
    groupKey: 'eo__inventory_stock',
    name: 'Elite Online — Warehouse Inventory',
    department: 'Inventory',
    companyEntity: 'Elite Online',
    permissionScope: 'inventory',
    description: 'Warehouse inventory inward, outward, SKU catalog & stock tracking.'
  },
  {
    groupKey: 'fabtex__fabric_orders',
    name: 'Elite Fabtex — Fabric & Orders',
    department: 'Fabric',
    companyEntity: 'Elite Fabtex',
    permissionScope: 'jobcards_fabric',
    description: 'Fabtex fabric orders, weaving logs & inward tracking.'
  },
  {
    groupKey: 'admin__all_access',
    name: 'Executive & Admin — Operations Desk',
    department: 'Admin',
    companyEntity: '',
    permissionScope: 'admin',
    description: 'Cross-department executive overview, system alerts & administrative operations.'
  }
];

/**
 * Synchronize member assignments for existing groups based on user permissions & company access.
 * Groups are created ONLY by Admin manually via the UI.
 */
async function syncCommunicationGroups() {
  try {
    const allUsers = await User.find({});

    // 2. Sync member access for ALL active chat rooms based on Company + Screen access
    const allRooms = await ChatRoom.find({ isArchived: { $ne: true } });
    for (const room of allRooms) {
      if (room.type === 'direct') continue; // Don't modify 1-on-1 private DMs

      const scope = (room.permissionScope || '').toLowerCase();
      const roomCompany = (room.companyEntity || '').trim().toLowerCase();

      const matchingUsers = allUsers.filter(u => {
        if (u.role === 'admin') return true;

        // Company Filter Check
        if (roomCompany) {
          const userCompanies = Array.isArray(u.allowedCompanies)
            ? u.allowedCompanies.map(c => String(c).trim().toLowerCase())
            : [];

          const isStitchingGroup = roomCompany.includes('stitching') || scope.includes('stitching');
          const hasCompanyMatch = userCompanies.length === 0 || userCompanies.includes('all') || userCompanies.includes(roomCompany) || (isStitchingGroup && (userCompanies.includes('elite stitching') || userCompanies.includes('elite digital print')));

          if (!hasCompanyMatch) {
            return false;
          }
        }

        // Screen Permission Filter Check
        if (!u.permissions || !Array.isArray(u.permissions)) return false;
        if (!scope || scope === 'general' || scope === 'direct_msg') return true;

        return u.permissions.some(p => {
          const perm = (p || '').toLowerCase();
          return perm === scope || perm.startsWith(scope) || scope.startsWith(perm);
        });
      });

      const memberIds = Array.from(new Set(matchingUsers.map(u => String(u._id))));
      room.members = memberIds;
      await room.save();
    }

    console.log('✅ Communication Authority Groups successfully synchronized by Company & Screen.');
    return { success: true };
  } catch (error) {
    console.error('❌ Error synchronizing communication groups:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  SYSTEM_COMMUNICATION_GROUPS,
  syncCommunicationGroups,
};
