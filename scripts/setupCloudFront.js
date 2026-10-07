const {
  CloudFrontClient,
  CreateDistributionCommand,
  ListDistributionsCommand,
  GetDistributionCommand,
} = require('@aws-sdk/client-cloudfront');
const {
  Route53Client,
  ChangeResourceRecordSetsCommand,
} = require('@aws-sdk/client-route-53');
require('dotenv').config();

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const ORIGIN_DOMAIN = 'erp.eliteedition.in';
const ORIGIN_ID = 'EC2-EliteEdition-Origin';
const HOSTED_ZONE_ID = 'Z05474651L1APGRBPMJ0H';

async function setupCloudFront() {
  console.log('=== Step 1: Initializing CloudFront Client ===');
  const cf = new CloudFrontClient({ credentials: creds, region: 'us-east-1' });

  // 1. Check existing distributions
  console.log('\n--- Checking for Existing CloudFront Distributions ---');
  const existing = await cf.send(new ListDistributionsCommand({}));
  let targetDist = null;

  for (const item of existing.DistributionList?.Items || []) {
    const origins = item.Origins?.Items || [];
    if (origins.some(o => o.DomainName === ORIGIN_DOMAIN || o.Id === ORIGIN_ID)) {
      targetDist = item;
      break;
    }
  }

  if (targetDist) {
    console.log(`Found existing distribution: ${targetDist.Id} (${targetDist.DomainName})`);
    console.log(`Status: ${targetDist.Status}`);
    return targetDist;
  }

  // 2. Create Distribution
  console.log(`\n--- Provisioning CloudFront Distribution for Origin: ${ORIGIN_DOMAIN} ---`);
  const callerRef = `elite-cf-${Date.now()}`;

  const distributionConfig = {
    CallerReference: callerRef,
    Comment: 'Elite Edition ERP Global Edge CDN Distribution',
    Enabled: true,
    WebACLId: 'arn:aws:wafv2:us-east-1:056885488683:global/webacl/EliteEdition-ProductionWebACL/68d56cf5-838f-4852-913f-7772f4b1d214',
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: ORIGIN_ID,
          DomainName: ORIGIN_DOMAIN,
          CustomOriginConfig: {
            HTTPPort: 80,
            HTTPSPort: 443,
            OriginProtocolPolicy: 'https-only',
            OriginSslProtocols: {
              Quantity: 1,
              Items: ['TLSv1.2'],
            },
            OriginReadTimeout: 60,
            OriginKeepaliveTimeout: 60,
          },
          ConnectionAttempts: 3,
          ConnectionTimeout: 10,
        },
      ],
    },
    DefaultCacheBehavior: {
      TargetOriginId: ORIGIN_ID,
      ViewerProtocolPolicy: 'redirect-to-https',
      AllowedMethods: {
        Quantity: 7,
        Items: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'],
        CachedMethods: {
          Quantity: 2,
          Items: ['GET', 'HEAD'],
        },
      },
      Compress: true,
      SmoothStreaming: false,
      MinTTL: 0,
      DefaultTTL: 0,
      MaxTTL: 0,
      ForwardedValues: {
        QueryString: true,
        Cookies: {
          Forward: 'all',
        },
        Headers: {
          Quantity: 4,
          Items: ['Authorization', 'Origin', 'Accept', 'Host'],
        },
        QueryStringCacheKeys: {
          Quantity: 0,
        },
      },
    },
    OrderedCacheBehaviors: {
      Quantity: 1,
      Items: [
        {
          PathPattern: '/assets/*',
          TargetOriginId: ORIGIN_ID,
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
              Quantity: 2,
              Items: ['GET', 'HEAD'],
            },
          },
          Compress: true,
          MinTTL: 86400,
          DefaultTTL: 604800,
          MaxTTL: 31536000,
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none',
            },
            Headers: {
              Quantity: 0,
            },
            QueryStringCacheKeys: {
              Quantity: 0,
            },
          },
        },
      ],
    },
    Aliases: {
      Quantity: 1,
      Items: ['erp.eliteedition.in'],
    },
    ViewerCertificate: {
      ACMCertificateArn: 'arn:aws:acm:us-east-1:056885488683:certificate/0b31dac8-abee-47f9-a780-611ededa4160',
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021',
    },
    HttpVersion: 'http2and3',
    PriceClass: 'PriceClass_All',
  };

  const createRes = await cf.send(
    new CreateDistributionCommand({ DistributionConfig: distributionConfig })
  );

  const dist = createRes.Distribution;
  console.log('\n=== CloudFront Distribution Successfully Created! ===');
  console.log('Distribution ID:', dist.Id);
  console.log('CloudFront Edge Domain:', dist.DomainName);
  console.log('Current Status:', dist.Status);
  console.log('\nYour static assets (/assets/*) are now configured for automated edge acceleration.');
  console.log(`Live CloudFront URL: https://${dist.DomainName}`);

  return dist;
}

setupCloudFront().catch((err) => {
  console.error('\nCloudFront Setup Failed:', err.message);
  process.exit(1);
});
