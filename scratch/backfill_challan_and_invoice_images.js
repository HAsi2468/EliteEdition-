const mongoose = require('mongoose');
const config = require('../src/config/config');
const { FabricChallan, BillingInvoice, JobCard, Design } = require('../src/db/models');

async function backfillImages() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  // Pre-load all JobCards and Designs into memory for high-speed matching
  console.log('Loading JobCards and Designs for fast image resolution...');
  const allJobCards = await JobCard.find({}, 'jobNo designNo designName imageUrl1 imageUrl2 proofing.artworkUrl').lean();
  const allDesigns = await Design.find({}, 'designNo designName imageUrl imageUrl2').lean();

  console.log(`Loaded ${allJobCards.length} JobCards and ${allDesigns.length} Designs.`);

  // Create fast lookup maps
  const jobMap = {};
  allJobCards.forEach(j => {
    const rawNo = String(j.jobNo || '').trim();
    if (rawNo) {
      jobMap[rawNo.toUpperCase()] = j;
      const numOnly = rawNo.match(/\d+/);
      if (numOnly) jobMap[numOnly[0]] = j;
    }
  });

  const designMap = {};
  allDesigns.forEach(d => {
    const dName = String(d.designName || '').trim().toUpperCase();
    const dNo = String(d.designNo || '').trim().toUpperCase();
    if (dName) {
      designMap[dName] = d;
      designMap[dName.replace(/^ED-?/, '')] = d;
    }
    if (dNo) {
      designMap[dNo] = d;
      designMap[dNo.replace(/^ED-?/, '')] = d;
    }
  });

  function resolveImageForDesignOrJob(designStr, jobStr) {
    // 1. Try Job Cards first
    const jobTokens = String(jobStr || '').split(/[,&/]+/).map(s => s.trim()).filter(Boolean);
    for (const jTok of jobTokens) {
      const numMatch = jTok.match(/\d+/);
      const key = numMatch ? numMatch[0] : jTok.toUpperCase();
      const jDoc = jobMap[key] || jobMap[jTok.toUpperCase()];
      if (jDoc) {
        if (jDoc.imageUrl1) return jDoc.imageUrl1;
        if (jDoc.imageUrl2) return jDoc.imageUrl2;
        if (jDoc.proofing && jDoc.proofing.artworkUrl) return jDoc.proofing.artworkUrl;

        // If job card has designNo, check designMap
        const jDesign = String(jDoc.designNo || jDoc.designName || '').trim().toUpperCase();
        if (jDesign && designMap[jDesign]) {
          const dObj = designMap[jDesign];
          if (dObj.imageUrl) return dObj.imageUrl;
          if (dObj.imageUrl2) return dObj.imageUrl2;
        }
      }
    }

    // 2. Try Design string directly
    const designTokens = String(designStr || '').split(/[,&/]+/).map(s => s.trim()).filter(Boolean);
    for (const dTok of designTokens) {
      const key = dTok.toUpperCase();
      const cleanKey = key.replace(/^ED-?/, '');
      const dDoc = designMap[key] || designMap[cleanKey];
      if (dDoc) {
        if (dDoc.imageUrl) return dDoc.imageUrl;
        if (dDoc.imageUrl2) return dDoc.imageUrl2;
      }
    }

    return '';
  }

  // ── 1. BACKFILL FABRIC DELIVERY CHALLANS ────────────────────────────────────
  console.log('\n--- Backfilling Fabric Delivery Challans ---');
  const challans = await FabricChallan.find({});
  let challanUpdatedCount = 0;

  for (const ch of challans) {
    const existingImg = ch.designImage || ch.imageUrl || '';
    if (!existingImg || existingImg.includes('drive.google.com')) {
      const resolved = resolveImageForDesignOrJob(ch.designNo, ch.jobNo);
      if (resolved && resolved !== existingImg) {
        ch.designImage = resolved;
        ch.imageUrl = resolved;
        await ch.save();
        challanUpdatedCount++;
      }
    }
  }
  console.log(`✅ Updated ${challanUpdatedCount} Fabric Delivery Challans with resolved design images.`);

  // ── 2. BACKFILL TAX INVOICES ────────────────────────────────────────────────
  console.log('\n--- Backfilling Tax Invoices ---');
  const invoices = await BillingInvoice.find({});
  let invoiceUpdatedCount = 0;

  for (const inv of invoices) {
    let invModified = false;
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      for (const item of inv.items) {
        const existingImg = item.imageUrl || '';
        if (!existingImg || existingImg.includes('drive.google.com')) {
          const resolved = resolveImageForDesignOrJob(item.itemName || item.description, item.jobNo || inv.ourChallanNo);
          if (resolved && resolved !== existingImg) {
            item.imageUrl = resolved;
            invModified = true;
          }
        }
      }
    }

    if (invModified) {
      await inv.save();
      invoiceUpdatedCount++;
    }
  }
  console.log(`✅ Updated ${invoiceUpdatedCount} Tax Invoices with resolved design images.`);

  await mongoose.disconnect();
  console.log('\n🎉 COMPLETED IMAGE BACKFILL FOR ALL CHALLANS & INVOICES!');
}

backfillImages().catch(err => {
  console.error('Error running backfill:', err);
  process.exit(1);
});
