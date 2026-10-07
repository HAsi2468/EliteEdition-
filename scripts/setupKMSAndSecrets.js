const {
  KMSClient,
  CreateKeyCommand,
  CreateAliasCommand,
  ListAliasesCommand,
  DescribeKeyCommand,
  EnableKeyRotationCommand,
} = require('@aws-sdk/client-kms');
const {
  SecretsManagerClient,
  CreateSecretCommand,
  DescribeSecretCommand,
  PutSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');
require('dotenv').config();

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const REGION = process.env.AWS_REGION || 'ap-south-1';
const KEY_ALIAS = 'alias/EliteEdition-ProductionKey';
const SECRET_NAME = 'EliteEdition/Production/AppConfig';

async function run() {
  console.log('===============================================================');
  console.log('🔐 AWS KMS & Secrets Manager — Automated Setup');
  console.log(`📍 Region: ${REGION} | Key Alias: ${KEY_ALIAS}`);
  console.log(`📦 Secret Name: ${SECRET_NAME}`);
  console.log('===============================================================\n');

  const kms = new KMSClient({ credentials: creds, region: REGION });
  const sm = new SecretsManagerClient({ credentials: creds, region: REGION });

  // ── STEP 1: VERIFY OR CREATE KMS CUSTOMER MASTER KEY (CMK) ──
  console.log(`--- Step 1: Checking KMS Customer Managed Key (${KEY_ALIAS}) ---`);
  let keyArn = null;
  let keyId = null;

  try {
    const aliasList = await kms.send(new ListAliasesCommand({}));
    const existingAlias = (aliasList.Aliases || []).find((a) => a.AliasName === KEY_ALIAS);

    if (existingAlias && existingAlias.TargetKeyId) {
      keyId = existingAlias.TargetKeyId;
      console.log(`✅ Existing KMS Key Alias found: ${KEY_ALIAS} -> Key ID: ${keyId}`);
      const desc = await kms.send(new DescribeKeyCommand({ KeyId: keyId }));
      keyArn = desc.KeyMetadata.Arn;
      console.log(`   Key ARN: ${keyArn}`);
    } else {
      console.log(`Creating new Customer Managed Key (CMK) with annual rotation...`);
      const createdKey = await kms.send(
        new CreateKeyCommand({
          Description: 'Elite Edition Production Customer Master Key for Database and Backup Encryption',
          KeyUsage: 'ENCRYPT_DECRYPT',
          CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
          Tags: [
            { TagKey: 'Environment', TagValue: 'Production' },
            { TagKey: 'Project', TagValue: 'EliteEditionERP' },
            { TagKey: 'ManagedBy', TagValue: 'AntigravityDevOps' },
          ],
        })
      );

      keyId = createdKey.KeyMetadata.KeyId;
      keyArn = createdKey.KeyMetadata.Arn;
      console.log(`✅ KMS Key created: ${keyId}`);
      console.log(`   Key ARN: ${keyArn}`);

      // Create Alias
      await kms.send(
        new CreateAliasCommand({
          AliasName: KEY_ALIAS,
          TargetKeyId: keyId,
        })
      );
      console.log(`✅ Key Alias created: ${KEY_ALIAS}`);

      // Enable annual key rotation
      try {
        await kms.send(new EnableKeyRotationCommand({ KeyId: keyId }));
        console.log(`✅ Automatic annual KMS key rotation enabled.`);
      } catch (rotErr) {
        console.warn(`⚠️ Key rotation notice: ${rotErr.message}`);
      }
    }
  } catch (kmsErr) {
    console.error(`❌ KMS Error: ${kmsErr.name} - ${kmsErr.message}`);
    throw kmsErr;
  }

  // ── STEP 2: VERIFY OR CREATE AWS SECRETS MANAGER SECRET ──
  console.log(`\n--- Step 2: Checking AWS Secrets Manager (${SECRET_NAME}) ---`);
  try {
    let secretExists = false;
    let secretArn = null;

    try {
      const desc = await sm.send(new DescribeSecretCommand({ SecretId: SECRET_NAME }));
      secretExists = true;
      secretArn = desc.ARN;
      console.log(`✅ Secrets Manager Secret already exists: ${desc.Name}`);
      console.log(`   Secret ARN: ${secretArn}`);
    } catch (e) {
      if (e.name === 'ResourceNotFoundException') {
        secretExists = false;
      } else {
        throw e;
      }
    }

    // Construct secret payload from production configuration
    const secretPayload = {
      PORT: process.env.PORT || '5002',
      NODE_ENV: 'production',
      MONGODB_URI: process.env.MONGODB_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      AWS_REGION: REGION,
      AWS_S3_BACKUP_BUCKET: 'elite-edition-backups-056885488683',
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
      DEPLOYMENT_ENV: 'production',
      UPDATED_AT: new Date().toISOString(),
    };

    if (!secretExists) {
      console.log(`Creating Secrets Manager Secret encrypted with KMS Key (${KEY_ALIAS})...`);
      const createRes = await sm.send(
        new CreateSecretCommand({
          Name: SECRET_NAME,
          Description: 'Elite Edition Production ERP Environment Secrets & Database URIs',
          KmsKeyId: keyId || KEY_ALIAS,
          SecretString: JSON.stringify(secretPayload),
          Tags: [
            { Key: 'Environment', Value: 'Production' },
            { Key: 'Project', Value: 'EliteEditionERP' },
          ],
        })
      );
      console.log(`✅ Secret created successfully: ${createRes.Name}`);
      console.log(`   Secret ARN: ${createRes.ARN}`);
    } else {
      console.log(`Updating existing Secret with latest verified parameters...`);
      await sm.send(
        new PutSecretValueCommand({
          SecretId: SECRET_NAME,
          SecretString: JSON.stringify(secretPayload),
        })
      );
      console.log(`✅ Secret values successfully updated and secured.`);
    }
  } catch (smErr) {
    console.error(`❌ Secrets Manager Error: ${smErr.name} - ${smErr.message}`);
    throw smErr;
  }

  // ── STEP 3: SUMMARY ──
  console.log('\n===============================================================');
  console.log('🎉 AWS KMS & SECRETS MANAGER PROVISIONING COMPLETED');
  console.log('===============================================================');
  console.log(`🔑 KMS Master Key:     ${KEY_ALIAS} (${keyId})`);
  console.log(`📦 Secrets Manager:    ${SECRET_NAME}`);
  console.log(`🛡️ Hardware Encryption: FIPS 140-2 Level 3 HSM Enveloped`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Deployment Script Error:', err.message);
  if (err.name === 'AccessDeniedException') {
    console.error('\n🔑 IAM PERMISSION REQUIRED:');
    console.error('The IAM user "elite-billing-service" needs policies attached:');
    console.error('   👉 "AWSKeyManagementServicePowerUser" (or kms:*)');
    console.error('   👉 "SecretsManagerReadWrite" (or secretsmanager:*)');
  }
  process.exit(1);
});
