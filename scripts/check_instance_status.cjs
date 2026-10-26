const { EC2Client, DescribeInstanceStatusCommand } = require('@aws-sdk/client-ec2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new EC2Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
  }
});

async function main() {
  try {
    const res = await client.send(new DescribeInstanceStatusCommand({
      InstanceIds: ['i-07e04075b693c42e6'],
      IncludeAllInstances: true
    }));
    const s = res.InstanceStatuses?.[0];
    console.log('Instance status:', s?.InstanceState?.Name);
    console.log('System Status:', s?.SystemStatus?.Status);
    console.log('Instance Status:', s?.InstanceStatus?.Status);
  } catch (err) {
    console.error('Check status error:', err.message);
  }
}

main();
