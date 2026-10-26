const { EC2Client, StopInstancesCommand, StartInstancesCommand, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new EC2Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
  }
});

const instanceId = 'i-07e04075b693c42e6';

async function waitForState(targetState) {
  process.stdout.write(`Waiting for instance to be ${targetState}...`);
  while (true) {
    const res = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const state = res.Reservations[0]?.Instances[0]?.State?.Name;
    process.stdout.write(` [${state}]`);
    if (state === targetState) {
      console.log(`\n✅ Instance reached state: ${state}`);
      return;
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}

async function main() {
  console.log('⚡ Performing HARD POWER CYCLE on instance:', instanceId);

  console.log('🛑 Sending Force Stop command...');
  await client.send(new StopInstancesCommand({
    InstanceIds: [instanceId],
    Force: true
  }));

  await waitForState('stopped');

  console.log('🚀 Sending Start command...');
  await client.send(new StartInstancesCommand({
    InstanceIds: [instanceId]
  }));

  await waitForState('running');
  console.log('🎉 Instance power cycle complete! Elastic IP 3.7.174.180 is preserved.');
}

main().catch(err => {
  console.error('Failed to power cycle:', err);
  process.exit(1);
});
