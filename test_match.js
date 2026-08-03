const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

async function testMatch() {
  await mongoose.connect(config.mongoose.url);

  const dateStart = '2026-08-03T00:00:00';
  const dateEnd = '2026-08-03T23:59:59';

  // Let's test with June dates as well as August dates
  const hasTime = (str) => /T|\s|:/.test(str);
  const getStartStr = (str) => {
    if (!str) return '';
    const clean = str.replace('T', ' ');
    return hasTime(str) ? clean : `${clean} 00:00:00`;
  };
  const getEndStr = (str) => {
    if (!str) return '';
    const clean = str.replace('T', ' ');
    return hasTime(str) ? clean : `${clean} 23:59:59`;
  };

  const matchPickup = {
    reversePickupCreatedDate: { $ne: null, $exists: true, $ne: "" }
  };
  if (dateStart) matchPickup.reversePickupCreatedDate.$gte = getStartStr(dateStart);
  if (dateEnd) matchPickup.reversePickupCreatedDate.$lte = getEndStr(dateEnd);

  console.log('Analytics match query:', JSON.stringify(matchPickup, null, 2));

  const analyticsResults = await db.SaleOrder.find(matchPickup).lean();
  console.log(`Analytics query returned ${analyticsResults.length} records for ${dateStart}`);

  // Test for June range
  const jStart = '2026-06-01T00:00:00';
  const jEnd = '2026-06-30T23:59:59';
  const juneMatch = {
    reversePickupCreatedDate: { $ne: null, $exists: true, $ne: "" }
  };
  if (jStart) juneMatch.reversePickupCreatedDate.$gte = getStartStr(jStart);
  if (jEnd) juneMatch.reversePickupCreatedDate.$lte = getEndStr(jEnd);

  const juneResults = await db.SaleOrder.find(juneMatch).lean();
  console.log(`June query returned ${juneResults.length} records.`);

  await mongoose.disconnect();
  process.exit(0);
}

testMatch().catch(err => {
  console.error(err);
  process.exit(1);
});
