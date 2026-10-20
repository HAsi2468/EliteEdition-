const mongoose = require('mongoose');
const config = require('../config/config');
const db = require('../db/models');
const { encryptData, generateToken } = require('../utils/auth');

async function createQaBot() {
  const uri = process.env.MONGODB_URL || config.mongoose.url;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  const botEmail = 'qa-bot@eliteedition.in';
  const botPasswordPlain = 'EliteQABot2026!Secure';

  let user = await db.user.findOne({ email: botEmail });
  const hashedPassword = await encryptData(botPasswordPlain);

  const botData = {
    name: 'QA Automation Bot',
    email: botEmail,
    role: 'admin',
    isMainAdmin: true,
    allowedCompanies: ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'],
    permissions: [
      'manage_users', 'view_reports', 'manage_inventory', 'manage_challans', 
      'manage_jobcards', 'manage_tasks', 'manage_finance', 'manage_communication'
    ],
    department: 'Quality Assurance',
    canManageTasks: true,
    canBroadcastChat: true,
    canExportReports: true,
    canDeleteRecords: true,
    canViewFinancials: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canDeleteJobCards: true,
    canAdvanceJobStage: true,
    canViewJobCosts: true,
    canCreateDesigns: true,
    canInputNewDesign: true,
    canEditDesigns: true,
    canDeleteDesigns: true,
    canViewDesignCosts: true,
    canAddFabricInward: true,
    canIssueFabricOutward: true,
    canTransferFabricLot: true,
    canDeleteFabricLogs: true,
    canViewFabricPrices: true,
    canCreateInvoices: true,
    canEditInvoiceRates: true,
    canCancelInvoices: true,
    canRecordPayments: true,
    canCreateStitchingJobs: true,
    canIssueStitchingChallans: true,
    canManageWorkerRates: true,
    status: 'Active',
    password: hashedPassword,
  };

  if (!user) {
    user = await db.user.create(botData);
    console.log('Created new QA Bot account:', botEmail);
  } else {
    Object.assign(user, botData);
    await user.save();
    console.log('Updated existing QA Bot account:', botEmail);
  }

  // Generate 365-day Bearer token for testing bot
  const oneYearMs = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const longLivedToken = generateToken(
    {
      userId: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      role: 'admin',
      isBot: true,
    },
    oneYearMs
  );

  console.log('\n======================================================');
  console.log('QA BOT ACCOUNT & CREDENTIALS');
  console.log('======================================================');
  console.log('Email:            ', botEmail);
  console.log('Password:         ', botPasswordPlain);
  console.log('Role:             ', user.role);
  console.log('User ID:          ', user._id.toString());
  console.log('Token Expiration:  365 Days');
  console.log('\n365-Day Bearer Token:');
  console.log(longLivedToken);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

createQaBot().catch((err) => {
  console.error('Failed to create QA Bot account:', err);
  process.exit(1);
});
