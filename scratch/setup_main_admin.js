const mongoose = require('mongoose');
const config = require('../src/config/config');
const db = require('../src/db/models');
const { encryptData } = require('../src/utils/auth');

async function run() {
  try {
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected to MongoDB');

    const email = 'harshitsidapara2468@gmail.com';
    const rawPass = 'Harshitd@727821';
    const hashedPassword = await encryptData(rawPass);

    let user = await db.user.findOne({ email });
    const ALL_COMPANIES = ['Elite Online', 'Elite Digital Print', 'Elite Stitching', 'Elite Edition', 'Elite Fabtex'];

    if (!user) {
      console.log('Creating Hasi Main Admin user...');
      user = await db.user.create({
        name: 'Hasi',
        email,
        password: hashedPassword,
        role: 'admin',
        isMainAdmin: true,
        allowedCompanies: ALL_COMPANIES,
        permissions: []
      });
      console.log('✅ Created Hasi Main Admin:', user);
    } else {
      console.log('Updating Hasi to Main Admin...');
      user.name = 'Hasi';
      user.password = hashedPassword;
      user.role = 'admin';
      user.isMainAdmin = true;
      user.allowedCompanies = ALL_COMPANIES;
      await user.save();
      console.log('✅ Updated Hasi Main Admin:', user._id);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error setting up Main Admin:', err);
    process.exit(1);
  }
}

run();
