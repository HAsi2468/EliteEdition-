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
        mongoDbAmount: 1245.00,
        mongoDbUsdAmount: 14.20,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 1681.30,
        notes: 'AWS Mumbai EC2 & CloudFront + MongoDB Atlas Dedicated M10 Replica Set + Cloudflare R2 Media Store',
        paymentStatus: 'pending',
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
        mongoDbAmount: 5180.00,
        mongoDbUsdAmount: 59.00,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 7359.23,
        notes: 'AWS Compute, Route53, Backup + MongoDB Atlas Dedicated M10 3-Node Cluster + Cloudflare R2 Storage',
        paymentStatus: 'paid',
        paymentDate: new Date('2026-09-30T18:30:00.000Z'),
        paymentMethod: 'Corporate Card',
        paymentRef: 'TXN-SEP26-INFRA'
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
        mongoDbAmount: 4950.00,
        mongoDbUsdAmount: 57.00,
        cloudflareAmount: 0.00,
        cloudflareUsdAmount: 0.00,
        totalAmount: 6903.33,
        notes: 'AWS EC2 + MongoDB Atlas Dedicated M10 Replica Set + Cloudflare R2',
        paymentStatus: 'paid',
        paymentDate: new Date('2026-08-31T18:30:00.000Z'),
        paymentMethod: 'Corporate Card',
        paymentRef: 'TXN-AUG26-INFRA'
      }
    },
    { upsert: true, new: true }
  );
  console.log('Updated August 2026 bill');

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
