global.crypto = require('crypto');
const mongoose = require('mongoose');
const axios = require('axios');
const db = require('./src/db/models');
const { getAccessToken } = require('./src/services/api.service');
const { transformProducts } = require('./src/utils/dataParser');

const CHUNK_SIZE = 800;
const splitData = (data, size) => {
  const chunks = [];
  for (let i = 0; i < data.length; i += size) {
    chunks.push(data.slice(i, i + size));
  }
  return chunks;
};

async function run() {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('No access token');

  console.log('[Background] Starting bulk product fetch for ALL available products in Uniware...');
  const allProductsMap = new Map();

  const response = await axios.post(
    'https://eliteedition.unicommerce.com/services/rest/v1/product/itemType/search',
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Cookie: 'unicommerce=app1',
      },
    }
  );
  
  if (response.data && response.data.elements) {
    response.data.elements.forEach((productInfo) => {
      if (productInfo.skuCode) {
        productInfo.orderDate = new Date();
        if (productInfo.name) productInfo.description = productInfo.name;
        allProductsMap.set(productInfo.skuCode, productInfo);
      }
    });
    console.log(`[Background] Successfully fetched ${allProductsMap.size} products from Uniware.`);
  }

  if (allProductsMap.size === 0) {
    console.log('[Background] No new products retrieved to store.');
    process.exit(0);
  }

  const transformedProducts = transformProducts(Array.from(allProductsMap.values()));
  const productChunks = splitData(transformedProducts, CHUNK_SIZE);

  let totalAddedProduct = 0;
  let totalAddedInventory = 0;

  for (const [index, chunk] of productChunks.entries()) {
    console.log(`[Background] Inserting chunk ${index + 1}/${productChunks.length}`);

    const inventoryOperations = chunk.map((item) => ({
      updateOne: {
        filter: { skuCode: item.skuCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    const invResult = await db.InventoryProduct.bulkWrite(inventoryOperations);
    totalAddedInventory += invResult.upsertedCount + invResult.modifiedCount;

    const operations = chunk.map((item) => {
      const baseSku = item.skuCode.split('_')[0];
      const { size, color, ...rest } = item;

      const cleanRest = {};
      for (const key in rest) {
        if (rest[key] !== null && rest[key] !== undefined) {
          cleanRest[key] = rest[key];
        }
      }

      delete cleanRest.skuCode;

      const updateDoc = { $set: cleanRest, $setOnInsert: { skuCode: baseSku } };

      if (size && size.length > 0) {
        updateDoc.$addToSet = updateDoc.$addToSet || {};
        updateDoc.$addToSet.size = { $each: size };
      }
      if (color && color.length > 0) {
        updateDoc.$addToSet = updateDoc.$addToSet || {};
        updateDoc.$addToSet.color = { $each: color };
      }

      return {
        updateOne: {
          filter: { skuCode: baseSku },
          update: updateDoc,
          upsert: true,
        },
      };
    });
    const result = await db.Product.bulkWrite(operations);
    totalAddedProduct += result.upsertedCount + result.modifiedCount;
  }
  console.log(`[Background] DB Import Complete! Added/Updated ${totalAddedProduct} grouped products and ${totalAddedInventory} exact inventory variants.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
