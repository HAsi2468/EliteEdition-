const db = require('../src/db/models');

function areDesignsEquivalent(a, b) {
  if (!a || !b) return false;
  const s1 = String(a).trim().toUpperCase();
  const s2 = String(b).trim().toUpperCase();
  if (s1 === s2) return true;
  const clean1 = s1.replace(/^(ED|PKD)[-\s]?/i, '').trim();
  const clean2 = s2.replace(/^(ED|PKD)[-\s]?/i, '').trim();
  if (clean1 && clean2 && clean1 === clean2) return true;
  return false;
}

function cleanDesignNameString(str) {
  if (!str || typeof str !== 'string') return '';
  const parts = str.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return str.trim();

  const uniqueList = [];
  for (const p of parts) {
    const existingIdx = uniqueList.findIndex(u => areDesignsEquivalent(u, p));
    if (existingIdx === -1) {
      uniqueList.push(p);
    } else {
      if (/^(ED|PKD)-/i.test(p) && !/^(ED|PKD)-/i.test(uniqueList[existingIdx])) {
        uniqueList[existingIdx] = p;
      }
    }
  }
  return uniqueList.join(', ');
}

async function fixDuplicateDesignStrings() {
  console.log('Starting duplicate design string cleanup...');

  // 1. Job Cards
  const jobCards = await db.JobCard.find({
    $or: [
      { designName: { $regex: ',' } },
      { designNo: { $regex: ',' } }
    ]
  });
  console.log(`Found ${jobCards.length} JobCards with comma in design name/no.`);

  let jcFixed = 0;
  for (const jc of jobCards) {
    const newName = cleanDesignNameString(jc.designName);
    const newNo = cleanDesignNameString(jc.designNo);

    if (newName !== jc.designName || newNo !== jc.designNo) {
      console.log(`Fixing JobCard #${jc.jobNo}: designName="${jc.designName}" -> "${newName}", designNo="${jc.designNo}" -> "${newNo}"`);
      jc.designName = newName;
      jc.designNo = newNo;
      await jc.save();
      jcFixed++;
    }
  }
  console.log(`Fixed ${jcFixed} JobCards.`);

  // 2. Fabric Challans
  const challans = await db.FabricChallan.find({ designNo: { $regex: ',' } });
  console.log(`Found ${challans.length} FabricChallans with comma in designNo.`);

  let chFixed = 0;
  for (const ch of challans) {
    const newNo = cleanDesignNameString(ch.designNo);
    if (newNo !== ch.designNo) {
      console.log(`Fixing FabricChallan #${ch.challanNo}: designNo="${ch.designNo}" -> "${newNo}"`);
      ch.designNo = newNo;
      await ch.save();
      chFixed++;
    }
  }
  console.log(`Fixed ${chFixed} FabricChallans.`);

  console.log('Duplicate design string cleanup completed.');
  process.exit(0);
}

fixDuplicateDesignStrings().catch(err => {
  console.error('Error fixing duplicate design strings:', err);
  process.exit(1);
});
