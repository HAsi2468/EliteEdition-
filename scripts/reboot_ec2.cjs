const { EC2Client, DescribeInstancesCommand, RebootInstancesCommand } = require('@aws-sdk/client-ec2');
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
  console.log('Connecting to AWS EC2 in region:', process.env.AWS_REGION || 'ap-south-1');
  try {
    const describeRes = await client.send(new DescribeInstancesCommand({}));
    let targetInstanceId = null;
    let targetInstanceName = null;

    for (const r of describeRes.Reservations || []) {
      for (const inst of r.Instances || []) {
        const nameTag = (inst.Tags || []).find(t => t.Key === 'Name');
        const name = nameTag ? nameTag.Value : 'Unknown';
        console.log(`Found instance: ${inst.InstanceId} (${name}) | IP: ${inst.PublicIpAddress} | State: ${inst.State?.Name}`);
        if (inst.PublicIpAddress === '3.7.174.180') {
          targetInstanceId = inst.InstanceId;
          targetInstanceName = name;
        }
      }
    }

    if (!targetInstanceId) {
      console.error('Could not find instance with public IP 3.7.174.180');
      return;
    }

    console.log(`\n🚀 Rebooting instance ${targetInstanceId} (${targetInstanceName})...`);
    await client.send(new RebootInstancesCommand({
      InstanceIds: [targetInstanceId]
    }));
    console.log(`✅ Reboot command sent successfully to ${targetInstanceId}!`);
  } catch (err) {
    console.error('Error with AWS EC2 API:', err.message);
  }
}

main();
