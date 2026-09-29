const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');

const ALL_PERMISSIONS = [
  'dashboard', 'inventory', 'catalog', 'returns', 'sales', 'reports',
  'unicommerce', 'myntra', 'jobcards', 'jobcards_list', 'jobcards_catalogue',
  'jobcards_tracking', 'jobcards_master', 'jobcards_fabric', 'jobcards_raw_materials',
  'jobcards_settings', 'jobcards_stitching_challan', 'jobcards_stitching_settings',
  'jobcards_printing_log', 'jobcards_fusing_log', 'jobcards_print_entry',
  'jobcards_billing', 'jobcards_costing', 'jobcards_engine', 'jobcards_split_view',
  'jobcards_challan', 'jobcards_complain', 'jobcards_expense', 'jobcards_expenses',
  'expense_dashboard', 'expense_create', 'expenses', 'jobcards_qa', 'qa',
  'qa_dashboard', 'jobcards_crm', 'crm_department', 'crm', 'jobcards_master_ai',
  'master_ai_agent', 'jobcards_business_connection', 'business_connection',
  'complaint_dashboard', 'complaint_create', 'admin', 'workspace',
  'communication', 'calendar', 'file_manager', 'inbox', 'activity_feed',
  'gantt', 'geo_map', 'advanced_dashboard', 'gallery'
];

const ALL_COMPANIES = [
  'Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'
];

async function main() {
  console.log('Connecting to database...');
  await mongoose.connect(config.mongoose.url, { serverSelectionTimeoutMS: 5000 });
  const userCollection = mongoose.connection.collection('user');
  const chatRoomsCollection = mongoose.connection.collection('chatrooms');

  // 1. Upgrade Harshit Sidapara (HASI) to full Main Admin / Super Admin
  const harshit = await userCollection.findOne({ email: 'harshitsidapara2468@gmail.com' });
  if (!harshit) {
    console.error('Harshit Sidapara user record not found in database!');
  } else {
    console.log('Found Harshit Sidapara:', harshit.name, harshit._id);
    await userCollection.updateOne(
      { email: 'harshitsidapara2468@gmail.com' },
      {
        $set: {
          isMainAdmin: true,
          role: 'admin',
          status: 'Active',
          allowedCompanies: ALL_COMPANIES,
          permissions: ALL_PERMISSIONS,
          canManageTasks: true,
          canBroadcastChat: true,
          canExportReports: true,
          canDeleteRecords: true,
          canViewFinancials: true,
          modified_date_time: new Date()
        }
      }
    );
    console.log('✅ Harshit Sidapara successfully updated to 👑 MAIN ADMIN with full master privileges.');
  }

  // 2. Remove redundant "System Admin" user (admin@elite.com)
  const systemAdmin = await userCollection.findOne({
    $or: [
      { email: 'admin@elite.com' },
      { name: 'System Admin' }
    ]
  });

  if (systemAdmin) {
    const sysId = systemAdmin._id.toString();
    console.log('Found redundant System Admin account:', sysId, systemAdmin.name, systemAdmin.email);

    // Clean up references in chatrooms
    const roomUpdateResult = await chatRoomsCollection.updateMany(
      { members: sysId },
      { $pull: { members: sysId } }
    );
    console.log('Removed System Admin from chat rooms. Modified:', roomUpdateResult.modifiedCount);

    // If Harshit is not in any of the company system chat rooms, ensure he is added
    if (harshit) {
      const harshitId = harshit._id.toString();
      await chatRoomsCollection.updateMany(
        { isSystemGroup: true, members: { $ne: harshitId } },
        { $addToSet: { members: harshitId } }
      );
      console.log('Ensured Harshit is in all active system chat rooms.');
    }

    // Delete redundant System Admin user
    const deleteResult = await userCollection.deleteOne({ _id: systemAdmin._id });
    console.log('✅ Successfully deleted redundant System Admin user. Deleted count:', deleteResult.deletedCount);
  } else {
    console.log('No redundant System Admin account found (already removed).');
  }

  // 3. Final verification of all admin users
  const admins = await userCollection.find({
    $or: [{ role: 'admin' }, { isMainAdmin: true }]
  }, { projection: { name: 1, email: 1, role: 1, isMainAdmin: 1 } }).toArray();

  console.log('\n--- CURRENT ADMIN USERS IN DATABASE ---');
  console.log(JSON.stringify(admins, null, 2));

  await mongoose.disconnect();
  console.log('Disconnected. Done!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
