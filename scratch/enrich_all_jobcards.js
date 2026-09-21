global.crypto = require('crypto');
const db = require('../src/db/models');
const mongoose = require('mongoose');

mongoose.connection.on('connected', async () => {
  try {
    console.log('Loading design catalogue...');
    const designs = await db.Design.find({}).lean();
    const dMap = new Map();
    designs.forEach(d => {
      if (d.designName) {
        dMap.set(d.designName.trim().toUpperCase(), d);
        const clean = d.designName.replace(/^ED-/i, '').trim().toUpperCase();
        dMap.set(clean, d);
      }
      if (d.designNo) {
        dMap.set(d.designNo.trim().toUpperCase(), d);
        const clean = d.designNo.replace(/^ED-/i, '').trim().toUpperCase();
        dMap.set(clean, d);
      }
    });

    console.log(`Loaded ${designs.length} designs. Fetching all job cards...`);
    const cards = await db.JobCard.find({}).lean();
    console.log(`Found ${cards.length} job cards. Processing updates...`);

    let updatedCount = 0;
    const bulkOps = [];

    for (const c of cards) {
      const raw = String(c.designName || c.designNo || '').trim().toUpperCase();
      if (!raw) continue;
      const clean = raw.replace(/^ED-/i, '').trim();
      const d = dMap.get(raw) || dMap.get(clean);
      if (!d) continue;

      const pcsNum = parseFloat(c.pcs) || 0;
      const top100 = Number(d.top100 || 0);
      const sleeve100 = Number(d.sleeve100 || 0);
      const bottom100 = Number(d.bottom100 || 0);
      const dupatta100 = Number(d.dupatta100 || 0);
      const cut100 = Number(d.cut100 || 0);
      const totalMtr100 = Number(d.totalMtr100 || 0);
      const setCopy100 = Number(d.setCopy100 || 0);

      const $set = {};

      if (!c.consumption && totalMtr100 > 0) {
        $set.consumption = (totalMtr100 / 100).toFixed(2);
      }
      if (!c.totalMtr && totalMtr100 > 0 && pcsNum > 0) {
        $set.totalMtr = ((totalMtr100 / 100) * pcsNum).toFixed(2);
      }
      if (!c.top && top100 > 0 && pcsNum > 0) {
        $set.top = ((top100 / 100) * pcsNum).toFixed(2);
      }
      if (!c.sleeve && sleeve100 > 0 && pcsNum > 0) {
        $set.sleeve = ((sleeve100 / 100) * pcsNum).toFixed(2);
      }
      if (!c.bottom && bottom100 > 0 && pcsNum > 0) {
        $set.bottom = ((bottom100 / 100) * pcsNum).toFixed(2);
      }
      if (!c.dupatta && dupatta100 > 0 && pcsNum > 0) {
        $set.dupatta = ((dupatta100 / 100) * pcsNum).toFixed(2);
      }
      if (!c.cut && cut100 > 0) {
        $set.cut = cut100.toString();
      }
      if (!c.setCopy && setCopy100 > 0 && pcsNum > 0) {
        $set.setCopy = Math.round((setCopy100 / 100) * pcsNum).toString();
      }
      if (!c.pass && d.pass) {
        $set.pass = d.pass;
      }
      if (!c.speed && d.speed) {
        $set.speed = d.speed;
      }
      if (!c.designer && d.designerName) {
        $set.designer = d.designerName;
      }
      if (!c.colourMatching && d.colourMatching) {
        $set.colourMatching = d.colourMatching;
      }
      if (!c.paperType && d.paperType) {
        $set.paperType = d.paperType;
      }
      const fused = d.fusingTemp || d.temperature || '';
      if (!c.temperature && fused) {
        $set.temperature = fused;
      }
      if (!c.fusingTemp && fused) {
        $set.fusingTemp = fused;
      }
      if (!c.fabric && d.fabricName) {
        $set.fabric = d.fabricName;
      }
      if (!c.category && d.category) {
        $set.category = d.category;
      }
      if (!c.colors && d.colors) {
        $set.colors = d.colors;
      }
      if (!c.panna && d.panna) {
        $set.panna = d.panna;
      }
      if (!c.imageUrl1 && d.imageUrl) {
        $set.imageUrl1 = d.imageUrl;
      }
      if (!c.imageUrl && d.imageUrl) {
        $set.imageUrl = d.imageUrl;
      }

      if (Object.keys($set).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: c._id },
            update: { $set }
          }
        });
      }
    }

    console.log(`Executing bulk update for ${bulkOps.length} job cards...`);
    if (bulkOps.length > 0) {
      const res = await db.JobCard.bulkWrite(bulkOps);
      console.log(`Bulk update result: modifiedCount = ${res.modifiedCount}`);
    }

    console.log('Enrichment complete!');
  } catch (err) {
    console.error('Enrichment error:', err);
  } finally {
    process.exit(0);
  }
});
