const { EC2Client, DescribeInstancesCommand, DescribeAddressesCommand } = require('@aws-sdk/client-ec2');
require('dotenv').config({ path: '/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/.env' });

async function check() {
  try {
    const client = new EC2Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    // Check addresses for 3.7.174.180
    console.log('Checking Elastic IP for 3.7.174.180...');
    const addrRes = await client.send(new DescribeAddressesCommand({
      PublicIps: ['3.7.174.180']
    }));
    console.log('Elastic IP info:', JSON.stringify(addrRes.Addresses, null, 2));

    // Find instance with public IP 3.7.174.180
    const instRes = await client.send(new DescribeInstancesCommand({
      Filters: [
        {
          Name: 'ip-address',
          Values: ['3.7.174.180']
        }
      ]
    }));

    if (instRes.Reservations && instRes.Reservations.length > 0) {
      const inst = instRes.Reservations[0].Instances[0];
      console.log('Found Instance ID:', inst.InstanceId);
      console.log('Instance Type:', inst.InstanceType);
      console.log('State:', inst.State.Name);
    } else {
      console.log('No reservation found matching IP directly, listing all instances in region...');
      const allRes = await client.send(new DescribeInstancesCommand({}));
      for (const r of allRes.Reservations || []) {
        for (const i of r.Instances || []) {
          console.log(`- Instance: ${i.InstanceId}, Type: ${i.InstanceType}, State: ${i.State.Name}, IP: ${i.PublicIpAddress}`);
        }
      }
    }
  } catch (err) {
    console.error('Error querying AWS EC2:', err.message);
  }
}

check();
