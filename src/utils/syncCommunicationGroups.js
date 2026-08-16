const { ChatRoom, user: User } = require('../db/models');

/**
 * Standard department authority group mappings based on permission prefixes
 */
const SYSTEM_COMMUNICATION_GROUPS = [
  {
    groupKey: 'production__job_card',
    name: 'Production — Job Card Management',
    department: 'Production',
    permissionScope: 'jobcards',
    description: 'Automated authority group for Job Card creation, status updates & production logs.'
  },
  {
    groupKey: 'production__printing_log',
    name: 'Production — Printing Department Log',
    department: 'Production',
    permissionScope: 'jobcards_printing_log',
    description: 'Real-time group for machine print logs, shift records & raw material entries.'
  },
  {
    groupKey: 'fabric__inventory',
    name: 'Fabric — Inventory & Stock Management',
    department: 'Fabric',
    permissionScope: 'jobcards_fabric',
    description: 'Fabric inward, stock adjustments, vendor challans & roll tracking group.'
  },
  {
    groupKey: 'billing__invoicing',
    name: 'Billing — Invoices & Accounts',
    department: 'Billing',
    permissionScope: 'jobcards_billing',
    description: 'GST invoice generation, payment receipts & customer billing updates.'
  },
  {
    groupKey: 'inventory__stock',
    name: 'Inventory — Goods & Products',
    department: 'Inventory',
    permissionScope: 'inventory',
    description: 'Warehouse inventory inward, outward, SKU catalog & stock tracking.'
  },
  {
    groupKey: 'quality__complaints',
    name: 'Quality & Support — Complaints',
    department: 'Quality',
    permissionScope: 'jobcards_complain',
    description: 'Digital print defects, shade variations, shade complaints & resolution logs.'
  },
  {
    groupKey: 'stitching__department',
    name: 'Stitching — Garment Production',
    department: 'Stitching',
    permissionScope: 'stitching',
    description: 'Garment job cards, stitching challans, design patterns & finishing updates.'
  },
  {
    groupKey: 'finance__expenses',
    name: 'Finance — Expenses & Petty Cash',
    department: 'Finance',
    permissionScope: 'jobcards_expense',
    description: 'Operational expenses, daily receipts, maintenance payments & petty cash.'
  },
  {
    groupKey: 'design__catalogue',
    name: 'Design Room — Artwork & Patterns',
    department: 'Design',
    permissionScope: 'jobcards_catalogue',
    description: 'Design master library, artwork approvals, PKD imports & pattern releases.'
  },
  {
    groupKey: 'admin__all_access',
    name: 'Executive & Admin — Operations Desk',
    department: 'Admin',
    permissionScope: 'admin',
    description: 'Cross-department executive overview, system alerts & administrative operations.'
  }
];

/**
 * Synchronize system groups and member assignments based on user permissions
 */
async function syncCommunicationGroups() {
  try {
    const allUsers = await User.find({});
    const admins = allUsers.filter(u => u.role === 'admin');
    const adminUserIds = admins.map(u => u._id);

    for (const groupDef of SYSTEM_COMMUNICATION_GROUPS) {
      let room = await ChatRoom.findOne({ groupKey: groupDef.groupKey });

      // Determine members who possess matching permission OR are admins
      const matchingUsers = allUsers.filter(u => {
        if (u.role === 'admin') return true;
        if (!u.permissions || !Array.isArray(u.permissions)) return false;

        const scope = groupDef.permissionScope;
        return u.permissions.some(p => p === scope || p.startsWith(scope) || scope.startsWith(p));
      });

      const memberIds = Array.from(new Set(matchingUsers.map(u => String(u._id))));

      if (room && room.isArchived) {
        // User/Admin explicitly deleted this group. Do not resurrect it.
        continue;
      }

      if (!room) {
        room = await ChatRoom.create({
          name: groupDef.name,
          type: 'group',
          department: groupDef.department,
          permissionScope: groupDef.permissionScope,
          groupKey: groupDef.groupKey,
          isSystemGroup: true,
          members: memberIds,
        });
      } else {
        room.name = groupDef.name;
        room.department = groupDef.department;
        room.permissionScope = groupDef.permissionScope;
        room.isSystemGroup = true;
        room.members = memberIds;
        await room.save();
      }
    }
    console.log('✅ Communication Authority Groups successfully synchronized.');
    return { success: true, count: SYSTEM_COMMUNICATION_GROUPS.length };
  } catch (error) {
    console.error('❌ Error synchronizing communication groups:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  SYSTEM_COMMUNICATION_GROUPS,
  syncCommunicationGroups,
};
