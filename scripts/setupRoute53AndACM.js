const {
  Route53Client,
  CreateHostedZoneCommand,
  ListHostedZonesCommand,
  CreateHealthCheckCommand,
  ChangeResourceRecordSetsCommand,
  GetHostedZoneCommand,
} = require('@aws-sdk/client-route-53');
const {
  ACMClient,
  RequestCertificateCommand,
  ListCertificatesCommand,
  DescribeCertificateCommand,
} = require('@aws-sdk/client-acm');
require('dotenv').config();

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const DOMAIN_NAME = 'eliteedition.in';
const SUBDOMAIN = 'erp.eliteedition.in';
const EC2_PUBLIC_IP = '3.7.174.180';

async function run() {
  console.log('=== Step 1: Initializing Route 53 & ACM Clients ===');
  const route53 = new Route53Client({ credentials: creds, region: 'us-east-1' });
  const acmMumbai = new ACMClient({ credentials: creds, region: 'ap-south-1' });
  const acmGlobal = new ACMClient({ credentials: creds, region: 'us-east-1' });

  // 1. Check or Create Route 53 Hosted Zone
  console.log(`\n--- Checking Route 53 Hosted Zone for: ${DOMAIN_NAME} ---`);
  let hostedZoneId = null;
  const existingZones = await route53.send(new ListHostedZonesCommand({}));
  const match = (existingZones.HostedZones || []).find(
    (z) => z.Name === `${DOMAIN_NAME}.` || z.Name === DOMAIN_NAME
  );

  if (match) {
    hostedZoneId = match.Id.replace('/hostedzone/', '');
    console.log(`Found existing Hosted Zone: ${hostedZoneId} (${match.Name})`);
  } else {
    console.log(`Creating new Public Hosted Zone for ${DOMAIN_NAME}...`);
    const createRes = await route53.send(
      new CreateHostedZoneCommand({
        Name: DOMAIN_NAME,
        CallerReference: `elite-edition-dns-${Date.now()}`,
        HostedZoneConfig: {
          Comment: 'Elite Edition Enterprise ERP Primary DNS Hosted Zone',
          PrivateZone: false,
        },
      })
    );
    hostedZoneId = createRes.HostedZone.Id.replace('/hostedzone/', '');
    console.log(`Hosted Zone created: ${hostedZoneId}`);
    console.log('Assigned Name Servers (NS):', createRes.DelegationSet.NameServers);
  }

  // 2. Create DNS Record for erp.eliteedition.in -> EC2 IP 3.7.174.180
  console.log(`\n--- Adding A Record for ${SUBDOMAIN} -> ${EC2_PUBLIC_IP} ---`);
  await route53.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Comment: `Route ${SUBDOMAIN} to primary EC2 server`,
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: SUBDOMAIN,
              Type: 'A',
              TTL: 300,
              ResourceRecords: [{ Value: EC2_PUBLIC_IP }],
            },
          },
        ],
      },
    })
  );
  console.log(`A Record for ${SUBDOMAIN} successfully configured!`);

  // 3. Create Route 53 Health Check
  console.log(`\n--- Creating Health Check for ${SUBDOMAIN} ---`);
  try {
    const healthCheckRes = await route53.send(
      new CreateHealthCheckCommand({
        CallerReference: `hc-erp-${Date.now()}`,
        HealthCheckConfig: {
          Type: 'HTTPS',
          FullyQualifiedDomainName: SUBDOMAIN,
          Port: 443,
          ResourcePath: '/',
          RequestInterval: 30, // seconds
          FailureThreshold: 3,
        },
      })
    );
    console.log(`Health Check created: ID ${healthCheckRes.HealthCheck.Id}`);
  } catch (hcErr) {
    console.log('Health check note:', hcErr.message);
  }

  // 4. Request ACM Wildcard Certificate in Mumbai (ap-south-1)
  console.log(`\n--- Requesting ACM SSL Certificate (*.${DOMAIN_NAME}, ${DOMAIN_NAME}) in ap-south-1 ---`);
  const certRes = await acmMumbai.send(
    new RequestCertificateCommand({
      DomainName: `*.${DOMAIN_NAME}`,
      SubjectAlternativeNames: [DOMAIN_NAME, SUBDOMAIN],
      ValidationMethod: 'DNS',
      KeyAlgorithm: 'RSA_2048',
    })
  );
  console.log(`ACM Certificate Requested: ${certRes.CertificateArn}`);

  // Wait a few seconds for DNS validation records to populate in ACM
  console.log('Waiting 5s for ACM DNS validation CNAME details...');
  await new Promise((r) => setTimeout(r, 5000));

  const desc = await acmMumbai.send(
    new DescribeCertificateCommand({ CertificateArn: certRes.CertificateArn })
  );

  const validationOptions = desc.Certificate.DomainValidationOptions || [];
  console.log('\n--- Inserting DNS Validation Records into Route 53 ---');
  for (const opt of validationOptions) {
    if (opt.ResourceRecord) {
      console.log(`Adding validation CNAME: ${opt.ResourceRecord.Name} -> ${opt.ResourceRecord.Value}`);
      await route53.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Comment: 'ACM DNS validation record',
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: opt.ResourceRecord.Name,
                  Type: opt.ResourceRecord.Type,
                  TTL: 300,
                  ResourceRecords: [{ Value: opt.ResourceRecord.Value }],
                },
              },
            ],
          },
        })
      );
    }
  }

  console.log('\n=== Route 53 and ACM Setup Completed Successfully! ===');
}

run().catch((err) => {
  console.error('\nSetup Failed:', err.message);
  process.exit(1);
});
