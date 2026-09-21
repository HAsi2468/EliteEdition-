global.crypto = require('crypto');
const db = require('../src/db/models');
const mongoose = require('mongoose');

mongoose.connection.on('connected', async () => {
  try {
    const cards = await db.JobCard.find({
      $or: [
        { createdBy: { $regex: 'Client', $options: 'i' } },
        { createdByName: { $regex: 'Client', $options: 'i' } },
        { emergencyNotes: { $regex: 'Order placed by', $options: 'i' } }
      ]
    });

    console.log(`Found ${cards.length} client job card(s) to verify/update.`);

    for (const c of cards) {
      const rawName = c.designName || c.designNo || '';
      if (!rawName) continue;

      let d = await db.Design.findOne({ designName: rawName }).lean();
      if (!d) d = await db.Design.findOne({ designNo: rawName }).lean();
      if (!d) {
        const clean = rawName.replace(/^ED-/i, '').trim();
        const esc = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        d = await db.Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${esc}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${esc}$`, 'i') } },
            { designName: { $regex: new RegExp(esc, 'i') } }
          ]
        }).lean();
      }

      if (!d) {
        console.log(`Design not found for ${rawName}`);
        continue;
      }

      const pcsNum = parseFloat(c.pcs) || 0;
      const top100 = Number(d.top100 || 0);
      const sleeve100 = Number(d.sleeve100 || 0);
      const bottom100 = Number(d.bottom100 || 0);
      const dupatta100 = Number(d.dupatta100 || 0);
      const cut100 = Number(d.cut100 || 0);
      const totalMtr100 = Number(d.totalMtr100 || 0);
      const setCopy100 = Number(d.setCopy100 || 0);

      const consumption = totalMtr100 > 0 ? (totalMtr100 / 100).toFixed(2) : (c.consumption || '');
      const totalMtr = totalMtr100 > 0 && pcsNum > 0 ? ((totalMtr100 / 100) * pcsNum).toFixed(2) : (c.totalMtr || '');
      const top = top100 > 0 && pcsNum > 0 ? ((top100 / 100) * pcsNum).toFixed(2) : (c.top || '');
      const sleeve = sleeve100 > 0 && pcsNum > 0 ? ((sleeve100 / 100) * pcsNum).toFixed(2) : (c.sleeve || '');
      const bottom = bottom100 > 0 && pcsNum > 0 ? ((bottom100 / 100) * pcsNum).toFixed(2) : (c.bottom || '');
      const dupatta = dupatta100 > 0 && pcsNum > 0 ? ((dupatta100 / 100) * pcsNum).toFixed(2) : (c.dupatta || '');
      const cut = cut100 > 0 ? cut100.toString() : (c.cut || '');
      const setCopy = setCopy100 > 0 && pcsNum > 0 ? Math.round((setCopy100 / 100) * pcsNum).toString() : (c.setCopy || '');

      const updates = {
        fabric: d.fabricName || c.fabric || 'FRENCH CREP',
        category: d.category || c.category || 'KURTI-SET',
        colors: d.colors || c.colors || '',
        panna: d.panna || c.panna || '58',
        pass: d.pass || c.pass || '',
        speed: d.speed || c.speed || '',
        designer: d.designerName || c.designer || '',
        colourMatching: d.colourMatching || c.colourMatching || '',
        paperType: d.paperType || c.paperType || '',
        temperature: d.fusingTemp || c.temperature || '',
        fusingTemp: d.fusingTemp || c.fusingTemp || '',
        consumption,
        totalMtr,
        top,
        sleeve,
        bottom,
        dupatta,
        cut,
        setCopy,
        imageUrl1: d.imageUrl || c.imageUrl1 || '',
        imageUrl2: d.imageUrl2 || c.imageUrl2 || '',
        imageUrl: d.imageUrl || c.imageUrl || ''
      };

      await db.JobCard.updateOne({ _id: c._id }, { $set: updates });
      console.log(`Updated ${c.jobNo} (${rawName}): totalMtr=${totalMtr}, top=${top}, sleeve=${sleeve}, bottom=${bottom}, dupatta=${dupatta}`);
    }

    console.log('Backfill complete!');
  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    process.exit(0);
  }
});
