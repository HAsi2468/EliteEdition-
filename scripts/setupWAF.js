const {
  WAFV2Client,
  CreateWebACLCommand,
  ListWebACLsCommand,
  GetWebACLCommand,
} = require('@aws-sdk/client-wafv2');
require('dotenv').config();

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const WEB_ACL_NAME = 'EliteEdition-ProductionWebACL';
// AWS WAF for CloudFront must always be in us-east-1 with Scope: 'CLOUDFRONT'
const SCOPE = 'CLOUDFRONT';
const REGION = 'us-east-1';

async function run() {
  console.log('===============================================================');
  console.log('🛡️  AWS WAF (Web Application Firewall) — Automated Setup');
  console.log(`📍 Scope: ${SCOPE} | Region: ${REGION}`);
  console.log(`🧱 Web ACL Name: ${WEB_ACL_NAME}`);
  console.log('===============================================================\n');

  const client = new WAFV2Client({ credentials: creds, region: REGION });

  // 1. Check if Web ACL already exists
  console.log(`--- Step 1: Checking for existing Web ACL "${WEB_ACL_NAME}" ---`);
  const listRes = await client.send(new ListWebACLsCommand({ Scope: SCOPE }));
  const existingAcl = (listRes.WebACLs || []).find((a) => a.Name === WEB_ACL_NAME);

  if (existingAcl) {
    console.log(`✅ Web ACL already exists: ${existingAcl.Name}`);
    console.log(`   ID: ${existingAcl.Id}`);
    console.log(`   ARN: ${existingAcl.ARN}`);

    const getRes = await client.send(
      new GetWebACLCommand({
        Name: existingAcl.Name,
        Scope: SCOPE,
        Id: existingAcl.Id,
      })
    );
    console.log(`   Rules count: ${getRes.WebACL?.Rules?.length || 0}`);
    return existingAcl;
  }

  // 2. Define Enterprise Security Rules
  console.log(`\n--- Step 2: Provisioning Web ACL with Managed Security Rule Sets ---`);

  const rules = [
    // 1. AWS Managed Common Rule Set (OWASP Top 10)
    {
      Name: 'AWS-AWSManagedRulesCommonRuleSet',
      Priority: 10,
      Statement: {
        ManagedRuleGroupStatement: {
          VendorName: 'AWS',
          Name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      OverrideAction: { None: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'EliteEdition-CommonRuleSet-Metric',
      },
    },

    // 2. AWS Known Bad Inputs Rule Set
    {
      Name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
      Priority: 20,
      Statement: {
        ManagedRuleGroupStatement: {
          VendorName: 'AWS',
          Name: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
      },
      OverrideAction: { None: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'EliteEdition-KnownBadInputs-Metric',
      },
    },

    // 3. AWS Amazon IP Reputation List (Known bots and hostile crawlers)
    {
      Name: 'AWS-AWSManagedRulesAmazonIpReputationList',
      Priority: 30,
      Statement: {
        ManagedRuleGroupStatement: {
          VendorName: 'AWS',
          Name: 'AWSManagedRulesAmazonIpReputationList',
        },
      },
      OverrideAction: { None: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'EliteEdition-IpReputation-Metric',
      },
    },

    // 4. AWS SQL Database Security Rule Set
    {
      Name: 'AWS-AWSManagedRulesSQLiRuleSet',
      Priority: 40,
      Statement: {
        ManagedRuleGroupStatement: {
          VendorName: 'AWS',
          Name: 'AWSManagedRulesSQLiRuleSet',
        },
      },
      OverrideAction: { None: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'EliteEdition-SQLiRuleSet-Metric',
      },
    },

    // 5. Rate-based Anti-DDoS Throttling (1000 requests per 5 minutes per IP)
    {
      Name: 'EliteEdition-RateLimit-1000Per5Min',
      Priority: 50,
      Action: { Block: {} },
      Statement: {
        RateBasedStatement: {
          Limit: 1000,
          AggregateKeyType: 'IP',
        },
      },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'EliteEdition-RateLimit-Metric',
      },
    },
  ];

  const createParams = {
    Name: WEB_ACL_NAME,
    Scope: SCOPE,
    DefaultAction: { Allow: {} },
    Description: 'Elite Edition Production Web ACL protecting ERP application and CloudFront CDN',
    Rules: rules,
    VisibilityConfig: {
      SampledRequestsEnabled: true,
      CloudWatchMetricsEnabled: true,
      MetricName: 'EliteEdition-ProductionWebACL-RootMetric',
    },
    Tags: [
      { Key: 'Environment', Value: 'Production' },
      { Key: 'Project', Value: 'EliteEditionERP' },
      { Key: 'ManagedBy', Value: 'AntigravityDevOps' },
    ],
  };

  const createRes = await client.send(new CreateWebACLCommand(createParams));
  console.log(`✅ Web ACL created successfully!`);
  console.log(`   Web ACL Name: ${createRes.Summary.Name}`);
  console.log(`   Web ACL ID:   ${createRes.Summary.Id}`);
  console.log(`   Web ACL ARN:  ${createRes.Summary.ARN}`);

  // 3. Summary
  console.log('\n===============================================================');
  console.log('🎉 AWS WAF WEB ACL DEPLOYMENT COMPLETED');
  console.log('===============================================================');
  console.log(`🛡️  Web ACL:          ${WEB_ACL_NAME}`);
  console.log(`📍 Scope:             ${SCOPE}`);
  console.log(`🔐 Managed Protections: OWASP Common Rules, Bad Inputs, SQLi, IP Reputation`);
  console.log(`⚡ Rate Throttling:    1,000 requests / 5 min per client IP`);
  console.log(`🔗 CloudFront Link:   Ready to associate with CloudFront Distribution`);
  console.log('===============================================================\n');

  return createRes.Summary;
}

run().catch((err) => {
  console.error('\n❌ Execution Error:', err.name, '-', err.message);
  process.exit(1);
});
