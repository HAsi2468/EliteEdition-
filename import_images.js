require('./src/polyfills/crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority')
  .then(async () => {
    console.log('Connected to MongoDB');
    const db = require('./src/db/models');
    const dir = path.join(__dirname, '../Digital print');
    const files = fs.readdirSync(dir);
    
    let processed = 0;
    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      // Remove extension
      let name = file.replace(/\.(jpg|jpeg|png|heic|tif)$/i, '').trim();
      
      const imageUrl = `/designs/${encodeURIComponent(file)}`;
      
      // Look for existing design
      let design = await db.Design.findOne({ designName: { $regex: new RegExp(`^${name}$`, 'i') } });
      
      if (design) {
        // Handle ED-317(1) -> maybe it's imageUrl2?
        if (file.includes('(1)')) {
            design.imageUrl2 = imageUrl;
        } else if (file.includes('(2)')) {
            // maybe notes? or just ignore since schema only has imageUrl and imageUrl2
        } else {
            design.imageUrl = imageUrl;
        }
        await design.save();
        console.log(`Updated ${name} -> ${imageUrl}`);
      } else {
        // Create new design
        // If it's a variant like (1), we should probably strip it for the main design check
        let baseName = name.replace(/\(\d+\)/, '').trim();
        let existingBase = await db.Design.findOne({ designName: { $regex: new RegExp(`^${baseName}$`, 'i') } });
        
        if (existingBase) {
            if (file.includes('(1)')) {
                existingBase.imageUrl2 = imageUrl;
                await existingBase.save();
                console.log(`Updated ${baseName} with second image -> ${imageUrl}`);
            }
        } else {
            try {
                await db.Design.create({
                  designName: baseName,
                  imageUrl: file.includes('(1)') ? '' : imageUrl,
                  imageUrl2: file.includes('(1)') ? imageUrl : '',
                  status: 'Active'
                });
                console.log(`Created ${baseName} -> ${imageUrl}`);
            } catch (e) {
                console.error(`Failed to create ${baseName}: ${e.message}`);
            }
        }
      }
      processed++;
    }
    console.log(`Finished processing ${processed} files.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
