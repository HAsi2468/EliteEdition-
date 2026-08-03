const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

async function testReturnsPdfQuery() {
  await mongoose.connect(config.mongoose.url);

  const dateStart = '2026-08-03T00:00:00';
  const dateEnd = '2026-08-03T23:59:59';

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

  const oldMatch = {
    reversePickupCreatedDate: {
      $gte: `${dateStart} 00:00:00`,
      $lte: `${dateEnd} 23:59:59`
    }
  };

  const fixedMatch = {
    reversePickupCreatedDate: {
      $gte: getStartStr(dateStart),
      $lte: getEndStr(dateEnd)
    }
  };

  console.log('OLD MATCH QUERY:', JSON.stringify(oldMatch));
  console.log('FIXED MATCH QUERY:', JSON.stringify(fixedMatch));

  const oldRes = await db.SaleOrder.find(oldMatch).lean();
  const fixedRes = await db.SaleOrder.find(fixedMatch).lean();

  console.log(`Old match results count: ${oldRes.length}`);
  console.log(`Fixed match results count: ${fixedRes.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

testReturnsPdfQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
