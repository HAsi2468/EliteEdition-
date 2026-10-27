const {
  EC2Client,
  DescribeInstancesCommand,
  StopInstancesCommand,
  ModifyInstanceAttributeCommand,
  StartInstancesCommand,
  waitUntilInstanceStopped,
  waitUntilInstanceRunning
} = require('@aws-sdk/client-ec2');
require('dotenv').config({ path: '/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/.env' });

const INSTANCE_ID = 'i-07e04075b693c42e6';
const TARGET_TYPE = 't3.medium';

async function upgrade() {
  console.log(`[1/5] Initializing AWS EC2 Client for ${INSTANCE_ID} in ap-south-1...`);
  const client = new EC2Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  // Verify current state
  const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
  const inst = desc.Reservations[0].Instances[0];
  console.log(`Current Instance Type: ${inst.InstanceType}, State: ${inst.State.Name}`);

  if (inst.InstanceType === TARGET_TYPE) {
    console.log(`Instance is already ${TARGET_TYPE}! Skipping type change.`);
    if (inst.State.Name !== 'running') {
      console.log('Starting instance...');
      await client.send(new StartInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
      await waitUntilInstanceRunning({ client, maxWaitTime: 180 }, { InstanceIds: [INSTANCE_ID] });
    }
    return;
  }

  // 1. Stop Instance
  console.log(`[2/5] Stopping EC2 instance ${INSTANCE_ID}... (Elastic IP 3.7.174.180 is preserved)`);
  await client.send(new StopInstancesCommand({ InstanceIds: [INSTANCE_ID] }));

  console.log('Waiting for instance to fully stop (this takes ~30-60 seconds)...');
  await waitUntilInstanceStopped({ client, maxWaitTime: 300 }, { InstanceIds: [INSTANCE_ID] });
  console.log('✓ Instance is STOPPED.');

  // 2. Modify Instance Type to t3.medium
  console.log(`[3/5] Upgrading instance attribute to ${TARGET_TYPE} (2 vCPU, 4 GiB RAM)...`);
  await client.send(new ModifyInstanceAttributeCommand({
    InstanceId: INSTANCE_ID,
    InstanceType: { Value: TARGET_TYPE }
  }));
  console.log(`✓ Successfully modified instance type to ${TARGET_TYPE}!`);

  // 3. Start Instance
  console.log(`[4/5] Starting upgraded EC2 instance ${INSTANCE_ID}...`);
  await client.send(new StartInstancesCommand({ InstanceIds: [INSTANCE_ID] }));

  console.log('Waiting for instance to reach running state...');
  await waitUntilInstanceRunning({ client, maxWaitTime: 300 }, { InstanceIds: [INSTANCE_ID] });
  console.log('✓ Instance is RUNNING with t3.medium!');

  // Verify updated description
  const updatedDesc = await client.send(new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
  const updatedInst = updatedDesc.Reservations[0].Instances[0];
  console.log(`[5/5] Final Verification:`);
  console.log(`- Instance ID: ${updatedInst.InstanceId}`);
  console.log(`- New Instance Type: ${updatedInst.InstanceType}`);
  console.log(`- State: ${updatedInst.State.Name}`);
  console.log(`- Public Elastic IP: ${updatedInst.PublicIpAddress}`);
  console.log('Upgrade completed successfully!');
}

upgrade().catch(err => {
  console.error('Upgrade failed:', err);
  process.exit(1);
});
