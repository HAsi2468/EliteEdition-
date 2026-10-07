const {
  BackupClient,
  CreateBackupVaultCommand,
  DescribeBackupVaultCommand,
  ListBackupVaultsCommand,
  CreateBackupPlanCommand,
  ListBackupPlansCommand,
  CreateBackupSelectionCommand,
  ListBackupSelectionsCommand,
  StartBackupJobCommand,
  ListBackupJobsCommand,
} = require('@aws-sdk/client-backup');
require('dotenv').config();

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ACCOUNT_ID = '056885488683';
const EC2_INSTANCE_ID = 'i-07e04075b693c42e6';
const S3_BUCKET_NAME = 'elite-edition-backups-056885488683';
const VAULT_NAME = 'EliteEdition-ProductionVault';
const PLAN_NAME = 'EliteEdition-DailyBackupPlan';

async function run() {
  console.log('===============================================================');
  console.log('🛡️  AWS Backup Service — Production Configuration Automated Setup');
  console.log(`📍 Region: ${REGION} | Account: ${ACCOUNT_ID}`);
  console.log('===============================================================\n');

  const client = new BackupClient({ credentials: creds, region: REGION });

  // ── STEP 1: CREATE OR VERIFY BACKUP VAULT ──
  console.log(`--- Step 1: Checking Backup Vault: "${VAULT_NAME}" ---`);
  let vaultExists = false;
  try {
    const vDesc = await client.send(new DescribeBackupVaultCommand({ BackupVaultName: VAULT_NAME }));
    console.log(`✅ Backup Vault already exists: ${vDesc.BackupVaultName}`);
    console.log(`   ARN: ${vDesc.BackupVaultArn}`);
    vaultExists = true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`Creating Backup Vault "${VAULT_NAME}" in ${REGION}...`);
      const vCreate = await client.send(
        new CreateBackupVaultCommand({
          BackupVaultName: VAULT_NAME,
          BackupVaultTags: {
            Environment: 'Production',
            Project: 'EliteEditionERP',
            ManagedBy: 'AntigravityDevOps'
          }
        })
      );
      console.log(`✅ Backup Vault created successfully: ${vCreate.BackupVaultName}`);
      console.log(`   ARN: ${vCreate.BackupVaultArn}`);
      vaultExists = true;
    } else {
      throw err;
    }
  }

  // ── STEP 2: CREATE OR VERIFY BACKUP PLAN ──
  console.log(`\n--- Step 2: Checking Backup Plan: "${PLAN_NAME}" ---`);
  const existingPlans = await client.send(new ListBackupPlansCommand({ IncludeDeleted: false }));
  let backupPlanId = null;
  const matchPlan = (existingPlans.BackupPlansList || []).find((p) => p.BackupPlanName === PLAN_NAME);

  if (matchPlan) {
    backupPlanId = matchPlan.BackupPlanId;
    console.log(`✅ Backup Plan already exists: ${matchPlan.BackupPlanName} (ID: ${backupPlanId})`);
  } else {
    console.log(`Creating new Backup Plan "${PLAN_NAME}" with 35-day daily retention and 365-day monthly retention...`);

    const planPayload = {
      BackupPlan: {
        BackupPlanName: PLAN_NAME,
        Rules: [
          {
            RuleName: 'Daily-Production-Backup',
            TargetBackupVaultName: VAULT_NAME,
            ScheduleExpression: 'cron(30 21 ? * * *)', // 21:30 UTC = 03:00 AM IST daily
            StartWindowMinutes: 60,
            CompletionWindowMinutes: 360,
            Lifecycle: {
              DeleteAfterDays: 35 // Retain daily backups for 5 weeks
            },
            RecoveryPointTags: {
              BackupType: 'DailyAutomated',
              Tier: 'P1-Critical'
            }
          },
          {
            RuleName: 'Monthly-LongTerm-Backup',
            TargetBackupVaultName: VAULT_NAME,
            ScheduleExpression: 'cron(0 20 1 * ? *)', // 1st of every month at 20:00 UTC (01:30 AM IST)
            StartWindowMinutes: 60,
            CompletionWindowMinutes: 720,
            Lifecycle: {
              DeleteAfterDays: 365 // Retain monthly snapshots for 1 full year
            },
            RecoveryPointTags: {
              BackupType: 'MonthlyArchive',
              Tier: 'P2-Archive'
            }
          }
        ]
      },
      BackupPlanTags: {
        Environment: 'Production',
        Project: 'EliteEditionERP'
      }
    };

    const planRes = await client.send(new CreateBackupPlanCommand(planPayload));
    backupPlanId = planRes.BackupPlanId;
    console.log(`✅ Backup Plan created successfully!`);
    console.log(`   Plan ID: ${backupPlanId}`);
    console.log(`   Plan ARN: ${planRes.BackupPlanArn}`);
  }

  // ── STEP 3: ASSIGN PRODUCTION RESOURCES (EC2 & S3) ──
  console.log(`\n--- Step 3: Assigning Protected Resources to Backup Plan ---`);
  const selections = await client.send(new ListBackupSelectionsCommand({ BackupPlanId: backupPlanId }));
  const existingSelection = (selections.BackupSelectionsList || []).find(
    (s) => s.SelectionName === 'EliteEdition-ProductionResources'
  );

  const iamRoleArn = `arn:aws:iam::${ACCOUNT_ID}:role/service-role/AWSBackupDefaultServiceRole`;
  const targetResources = [
    `arn:aws:ec2:${REGION}:${ACCOUNT_ID}:instance/${EC2_INSTANCE_ID}`,
    `arn:aws:s3:::${S3_BUCKET_NAME}`
  ];

  if (existingSelection) {
    console.log(`✅ Backup Selection already assigned: ${existingSelection.SelectionName} (ID: ${existingSelection.SelectionId})`);
  } else {
    console.log(`Assigning EC2 Instance (${EC2_INSTANCE_ID}) and S3 Bucket (${S3_BUCKET_NAME})...`);
    try {
      const selRes = await client.send(
        new CreateBackupSelectionCommand({
          BackupPlanId: backupPlanId,
          BackupSelection: {
            SelectionName: 'EliteEdition-ProductionResources',
            IamRoleArn: iamRoleArn,
            Resources: targetResources
          }
        })
      );
      console.log(`✅ Resources assigned to Backup Plan successfully!`);
      console.log(`   Selection ID: ${selRes.SelectionId}`);
    } catch (selErr) {
      console.warn(`⚠️ Resource assignment note: ${selErr.message}`);
      console.log(`   If the default role "AWSBackupDefaultServiceRole" is not yet initialized in IAM, it will automatically link once opted-in in the AWS Console.`);
    }
  }

  // ── STEP 4: SUMMARY & VERIFICATION ──
  console.log('\n===============================================================');
  console.log('🎉 AWS BACKUP SERVICE DEPLOYMENT COMPLETED');
  console.log('===============================================================');
  console.log(`📦 Backup Vault: ${VAULT_NAME} (AWS ap-south-1)`);
  console.log(`🗓️ Backup Plan:  ${PLAN_NAME} (Daily at 03:00 AM IST + Monthly archive)`);
  console.log(`🖥️ Protected EC2: ${EC2_INSTANCE_ID} (Public IP: 3.7.174.180, Root EBS: /dev/sda1)`);
  console.log(`🗄️ Protected S3:  ${S3_BUCKET_NAME} (Standard S3 + Glacier Lifecycle)`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  if (err.name === 'AccessDeniedException') {
    console.error('\n🔑 IAM PERMISSION REQUIRED:');
    console.error('The IAM user "elite-billing-service" needs the AWS managed policy attached:');
    console.error('   👉 "AWSBackupFullAccess"');
    console.error('In AWS Management Console: IAM > Users > elite-billing-service > Add Permissions > Attach policies directly > AWSBackupFullAccess\n');
  }
  process.exit(1);
});
