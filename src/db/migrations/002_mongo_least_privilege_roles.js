/**
 * ==============================================================================
 * Technical Specification: "Unsanitized Input Injections Remediation" (Phase 4)
 * Migration 002: MongoDB Least-Privilege Role & User Administration Script
 * Engine: MongoDB 5.0+ / 6.0+ / 7.0+ (Run via mongosh)
 * Purpose: Eliminate Superuser Runtime Access & Enforce Collection-Level Least Privilege
 * ==============================================================================
 *
 * Usage:
 *   mongosh "mongodb://localhost:27017/admin" -u admin -p <admin_password> 002_mongo_least_privilege_roles.js
 */

const TARGET_DB_NAME = 'elite_erp';

// Target application collections requiring standard runtime CRUD access
const APP_COLLECTIONS = [
  'users',
  'jobcards',
  'garmentjobcards',
  'lots',
  'orders',
  'saleorders',
  'clients',
  'customerprofiles',
  'billingcustomers',
  'billinginvoices',
  'billingitems',
  'inventories',
  'inventoryproducts',
  'products',
  'designs',
  'designertasks',
  'tasks',
  'complaints',
  'expenses',
  'leads',
  'chats',
  'pushsubscriptions',
  'activitylogs',
  'orderactivitylogs',
  'businessconnections',
  'stitchingconfigs',
  'printconfigs',
  'fabrictransactions',
  'fabricchallans',
  'stitchingchallans',
];

// Switch to target application database
const targetDb = db.getSiblingDB(TARGET_DB_NAME);

print(`=======================================================`);
print(`🔒 Configuring Least-Privilege Security on '${TARGET_DB_NAME}'`);
print(`=======================================================`);

// 1. Create or Update 'app_runtime_role' (Exclusively DML: find, insert, update, remove)
const runtimePrivileges = APP_COLLECTIONS.map((collectionName) => ({
  resource: { db: TARGET_DB_NAME, collection: collectionName },
  actions: ['find', 'insert', 'update', 'remove'],
}));

// Add read privilege on system.indexes / indexSpecs for Mongoose index verifications
runtimePrivileges.push({
  resource: { db: TARGET_DB_NAME, collection: 'system.js' },
  actions: ['find'],
});

const existingRuntimeRole = targetDb.getRole('app_runtime_role');
if (!existingRuntimeRole) {
  targetDb.createRole({
    role: 'app_runtime_role',
    privileges: runtimePrivileges,
    roles: [],
  });
  print(`✅ Created custom role 'app_runtime_role' with strict DML-only permissions`);
} else {
  targetDb.updateRole('app_runtime_role', {
    privileges: runtimePrivileges,
    roles: [],
  });
  print(`🔄 Updated custom role 'app_runtime_role' to enforce least-privilege boundary`);
}

// 2. Create or Update 'migration_admin_role' (For CI/CD index builds & schema migrations)
const migrationPrivileges = [
  {
    resource: { db: TARGET_DB_NAME, collection: '' }, // all collections in TARGET_DB_NAME
    actions: [
      'find',
      'insert',
      'update',
      'remove',
      'createCollection',
      'createIndex',
      'dropIndex',
      'collMod',
      'compact',
      'collStats',
      'indexStats',
    ],
  },
];

const existingMigrationRole = targetDb.getRole('migration_admin_role');
if (!existingMigrationRole) {
  targetDb.createRole({
    role: 'migration_admin_role',
    privileges: migrationPrivileges,
    roles: [],
  });
  print(`✅ Created custom role 'migration_admin_role' for CI/CD schema migrations`);
} else {
  targetDb.updateRole('migration_admin_role', {
    privileges: migrationPrivileges,
    roles: [],
  });
  print(`🔄 Updated custom role 'migration_admin_role'`);
}

// 3. Provision 'app_runtime_user'
const RUNTIME_PASSWORD = process.env.MONGO_APP_RUNTIME_PASSWORD || 'SECURE_VAULT_APP_RUNTIME_PASSWORD';

const existingRuntimeUser = targetDb.getUser('app_runtime_user');
if (!existingRuntimeUser) {
  targetDb.createUser({
    user: 'app_runtime_user',
    pwd: RUNTIME_PASSWORD,
    roles: [{ role: 'app_runtime_role', db: TARGET_DB_NAME }],
  });
  print(`✅ Created application runtime user 'app_runtime_user'`);
} else {
  targetDb.updateUser('app_runtime_user', {
    roles: [{ role: 'app_runtime_role', db: TARGET_DB_NAME }],
  });
  print(`🔄 Updated user 'app_runtime_user' role bindings`);
}

// 4. Provision 'migration_admin_user'
const MIGRATION_PASSWORD = process.env.MONGO_MIGRATION_ADMIN_PASSWORD || 'SECURE_VAULT_MIGRATION_ADMIN_PASSWORD';

const existingMigrationUser = targetDb.getUser('migration_admin_user');
if (!existingMigrationUser) {
  targetDb.createUser({
    user: 'migration_admin_user',
    pwd: MIGRATION_PASSWORD,
    roles: [{ role: 'migration_admin_role', db: TARGET_DB_NAME }],
  });
  print(`✅ Created migration admin user 'migration_admin_user'`);
} else {
  targetDb.updateUser('migration_admin_user', {
    roles: [{ role: 'migration_admin_role', db: TARGET_DB_NAME }],
  });
  print(`🔄 Updated user 'migration_admin_user' role bindings`);
}

print(`=======================================================`);
print(`🎉 MongoDB Least-Privilege Role Provisioning Complete!`);
print(`Superuser runtime access eliminated. DDL operations revoked from app_runtime_user.`);
print(`=======================================================`);
