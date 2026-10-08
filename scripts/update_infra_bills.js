const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function updateBills() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const InfrastructureBill = require('../src/db/models/infrastructureBill.model');

  // October 2026
  await InfrastructureBill.findOneAndUpdate(
    { month: 'October 2026' },
    {
      $set: {
        month: 'October 2026',
        awsAmount: 436.30,
        awsUsdAmount: 5.04,
        mongoDbAmount: 1245.00,
        mongoDbUsdAmount: 14.20,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 1681.30,
        notes: 'AWS Mumbai EC2 & CloudFront + MongoDB Atlas Dedicated M10 Replica Set + Cloudflare R2 Media Store',
        paymentStatus: 'UNPAID',
        paidAt: null,
        platformPayments: {
          aws: {
            status: 'UNPAID',
            notes: 'Current October billing cycle accumulating • Due 03/11/2026',
          },
          mongodb: {
            status: 'UNPAID',
            notes: 'Monthly Atlas Dedicated M10 Invoice • Due 01/11/2026',
          },
          cloudflare: {
            status: 'PAID',
            paidAt: new Date('2026-10-01T00:00:00.000Z'),
            paymentMethod: 'Free Allowance / Zero-Egress Tier',
            paymentRef: 'CF-R2-FREE',
            notes: '10 GB Free Storage Allowance',
          },
        },
      }
    },
    { upsert: true, new: true }
  );
  console.log('Updated October 2026 bill');

  // September 2026
  await InfrastructureBill.findOneAndUpdate(
    { month: 'September 2026' },
    {
      $set: {
        month: 'September 2026',
        awsAmount: 2179.23,
        awsUsdAmount: 25.19,
        mongoDbAmount: 5180.00,
        mongoDbUsdAmount: 59.00,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 7359.23,
        notes: 'AWS Compute, Route53, Backup + MongoDB Atlas Dedicated M10 3-Node Cluster + Cloudflare R2 Storage',
        paymentStatus: 'PAID',
        paidAt: new Date('2026-10-03T10:00:00.000Z'),
        paymentDate: new Date('2026-10-03T10:00:00.000Z'),
        paymentMethod: 'Corporate Card',
        paymentRef: 'TXN-SEP26-INFRA',
        platformPayments: {
          aws: {
            status: 'PAID',
            paidAt: new Date('2026-10-03T10:00:00.000Z'),
            paymentMethod: 'AWS Auto-Debit / Corporate Card',
            paymentRef: 'AWS-SEP26-INV-9921',
            notes: 'EC2 Compute, Route53, Backup settled via Auto-Debit',
          },
          mongodb: {
            status: 'PAID',
            paidAt: new Date('2026-10-03T10:30:00.000Z'),
            paymentMethod: 'Corporate Card',
            paymentRef: 'ATLAS-SEP26-INV-4412',
            notes: 'M10 Dedicated 3-Node Replica Set settled',
          },
          cloudflare: {
            status: 'PAID',
            paidAt: new Date('2026-10-01T00:00:00.000Z'),
            paymentMethod: 'Free Allowance / Zero-Egress Tier',
            paymentRef: 'CF-R2-FREE',
            notes: 'Zero Billed / Free Allowance',
          },
        },
      }
    },
    { upsert: true, new: true }
  );
  console.log('Updated September 2026 bill');

  // August 2026
  await InfrastructureBill.findOneAndUpdate(
    { month: 'August 2026' },
    {
      $set: {
        month: 'August 2026',
        awsAmount: 1953.33,
        awsUsdAmount: 22.58,
        mongoDbAmount: 4950.00,
        mongoDbUsdAmount: 57.00,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 6903.33,
        notes: 'AWS EC2 + MongoDB Atlas Dedicated M10 Replica Set + Cloudflare R2',
        paymentStatus: 'PAID',
        paidAt: new Date('2026-09-03T10:00:00.000Z'),
        paymentDate: new Date('2026-09-03T10:00:00.000Z'),
        paymentMethod: 'Corporate Card',
        paymentRef: 'TXN-AUG26-INFRA',
        platformPayments: {
          aws: {
            status: 'PAID',
            paidAt: new Date('2026-09-03T10:00:00.000Z'),
            paymentMethod: 'AWS Auto-Debit / Corporate Card',
            paymentRef: 'AWS-AUG26-INV-8812',
            notes: 'AWS Mumbai EC2 & CloudFront settled',
          },
          mongodb: {
            status: 'PAID',
            paidAt: new Date('2026-09-03T10:30:00.000Z'),
            paymentMethod: 'Corporate Card',
            paymentRef: 'ATLAS-AUG26-INV-3321',
            notes: 'M10 Dedicated 3-Node Replica Set settled',
          },
          cloudflare: {
            status: 'PAID',
            paidAt: new Date('2026-09-01T00:00:00.000Z'),
            paymentMethod: 'Free Allowance / Zero-Egress Tier',
            paymentRef: 'CF-R2-FREE',
            notes: 'Zero Billed / Free Allowance',
          },
        },
      }
    },
    { upsert: true, new: true }
  );
  console.log('Updated August 2026 bill');

  // July 2026
  await InfrastructureBill.findOneAndUpdate(
    { month: 'July 2026' },
    {
      $set: {
        paymentStatus: 'PAID',
        paidAt: new Date('2026-08-03T10:00:00.000Z'),
        paymentMethod: 'AWS Auto-Debit / Credit Card',
        paymentRef: 'AWS-INV-JUL2026',
        platformPayments: {
          aws: {
            status: 'PAID',
            paidAt: new Date('2026-08-03T10:00:00.000Z'),
            paymentMethod: 'AWS Auto-Debit / Credit Card',
            paymentRef: 'AWS-INV-JUL2026',
            notes: 'AWS Compute & Route53 settled via Auto-Debit',
          },
          mongodb: {
            status: 'PAID',
            notes: 'Not provisioned',
          },
          cloudflare: {
            status: 'PAID',
            paidAt: new Date('2026-08-01T00:00:00.000Z'),
            paymentMethod: 'Free Allowance / Zero-Egress Tier',
            paymentRef: 'CF-R2-FREE',
            notes: 'Free Allowance',
          },
        },
      }
    }
  );
  console.log('Updated July 2026 bill');

  // June 2026
  await InfrastructureBill.findOneAndUpdate(
    { month: 'June 2026' },
    {
      $set: {
        paymentStatus: 'PAID',
        paidAt: new Date('2026-07-03T10:00:00.000Z'),
        paymentMethod: 'AWS Auto-Debit / Credit Card',
        paymentRef: 'AWS-INV-JUN2026',
        platformPayments: {
          aws: {
            status: 'PAID',
            paidAt: new Date('2026-07-03T10:00:00.000Z'),
            paymentMethod: 'AWS Auto-Debit / Credit Card',
            paymentRef: 'AWS-INV-JUN2026',
            notes: 'AWS Compute settled via Auto-Debit',
          },
          mongodb: {
            status: 'PAID',
            notes: 'Not provisioned',
          },
          cloudflare: {
            status: 'PAID',
            paidAt: new Date('2026-07-01T00:00:00.000Z'),
            paymentMethod: 'Free Allowance / Zero-Egress Tier',
            paymentRef: 'CF-R2-FREE',
            notes: 'Free Allowance',
          },
        },
      }
    }
  );
  console.log('Updated June 2026 bill');

  const all = await InfrastructureBill.find({}).sort({ createdAt: -1 });
  console.log('\n--- Current Infrastructure Bills ---');
  all.forEach(b => {
    console.log(`${b.month} | AWS: ₹${b.awsAmount} | Mongo: ₹${b.mongoDbAmount} | Cloudflare: ₹${b.cloudflareAmount} | Total: ₹${b.totalAmount} | Status: ${b.paymentStatus}`);
  });

  await mongoose.disconnect();
  console.log('Done!');
}

updateBills().catch(err => {
  console.error('Error updating bills:', err);
  process.exit(1);
});
