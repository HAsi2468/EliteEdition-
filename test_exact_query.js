const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

async function testExactQuery() {
  await mongoose.connect(config.mongoose.url);

  const dateStart = '2026-08-03T00:00:00';
  const dateEnd = '2026-08-03T23:59:59';

  const cleanDateStart = dateStart.split('T')[0];
  const cleanDateEnd = dateEnd.split('T')[0];

  const matchStage = {
    reversePickupCreatedDate: {
      $ne: null, $exists: true, $ne: "",
      $gte: `${cleanDateStart} 00:00:00`,
      $lte: `${cleanDateEnd} 23:59:59`
    }
  };

  console.log('CLEAN MATCH QUERY:', JSON.stringify(matchStage, null, 2));

  const pipeline = [
    { $match: matchStage },
    { $group: {
        _id: {
          brand: { $cond: { if: { $or: [{ $eq: ['$itemTypeBrand', ''] }, { $eq: [{ $ifNull: ['$itemTypeBrand', null] }, null] }] }, then: 'Unknown', else: '$itemTypeBrand' } },
          baseSku: { $arrayElemAt: [{ $split: ['$itemSKUCode', '_'] }, 0] },
          size: { $cond: { if: { $or: [{ $eq: ['$itemTypeSize', ''] }, { $eq: [{ $ifNull: ['$itemTypeSize', null] }, null] }] }, then: 'N/A', else: '$itemTypeSize' } }
        },
        quantity: { $sum: { $ifNull: ['$saleCount', 1] } },
        sellableAmount: { $sum: { $multiply: [{ $ifNull: ['$saleCount', 1] }, { $convert: { input: '$totalPrice', to: 'double', onError: 0, onNull: 0 } }] } }
    }},
    { $group: {
        _id: { brand: '$_id.brand', baseSku: '$_id.baseSku' },
        variations: { $push: { size: '$_id.size', quantity: '$quantity', sellableAmount: '$sellableAmount' } },
        skuQty: { $sum: '$quantity' },
        skuAmt: { $sum: '$sellableAmount' }
    }},
    { $group: {
        _id: '$_id.brand',
        products: { $push: { sku: '$_id.baseSku', qty: '$skuQty', amt: '$skuAmt', variations: '$variations' } },
        brandQty: { $sum: '$skuQty' },
        brandAmt: { $sum: '$skuAmt' }
    }}
  ];

  const rawBrands = await db.SaleOrder.aggregate(pipeline);
  console.log(`Aggregation returned ${rawBrands.length} brands:`);
  console.log(JSON.stringify(rawBrands, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

testExactQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
