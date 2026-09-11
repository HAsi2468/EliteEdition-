const db = require('../db/models');
const logger = require('../config/logger');
const { getAccessToken, fetchEntireCatalog } = require('../services/api.service');
const { extractBaseSku, extractSizeFromSku } = require('../utils/skuHelper');

async function runSync() {
  console.log('🚀 Starting Full Uniware SKU & Image Catalog Sync...');

  // 1. Get Access Token
  const token = await getAccessToken();
  if (!token) {
    console.error('❌ Failed to obtain Unicommerce Access Token. Exiting.');
    process.exit(1);
  }
  console.log('✅ Unicommerce Access Token obtained.');

  // 2. Fetch full catalog from Uniware
  let catalogElements = [];
  try {
    catalogElements = await fetchEntireCatalog(token);
    console.log(`📦 Fetched ${catalogElements.length} product elements from Uniware.`);
  } catch (err) {
    console.error('❌ Failed to fetch catalog from Uniware:', err.message);
  }

  // Map Uniware catalog items by full SKU and base SKU
  const uniwareMap = new Map();
  const baseSkuImageMap = new Map();

  catalogElements.forEach(item => {
    if (!item.skuCode) return;
    const fullSku = item.skuCode.trim();
    const baseSku = extractBaseSku(fullSku);
    const imageUrl = item.imageUrl || item.image || item.photo || '';

    uniwareMap.set(fullSku.toUpperCase(), { ...item, baseSku, imageUrl });
    if (baseSku && imageUrl && !baseSkuImageMap.has(baseSku.toUpperCase())) {
      baseSkuImageMap.set(baseSku.toUpperCase(), imageUrl);
    }
  });

  console.log(`📊 Distinct base SKUs with images in Uniware: ${baseSkuImageMap.size}`);

  // 3. Update / Sync InventoryProduct collection
  console.log('🔄 Syncing InventoryProduct collection...');
  let invProductUpdated = 0;
  for (const item of catalogElements) {
    if (!item.skuCode) continue;
    const fullSku = item.skuCode.trim();
    const baseSku = extractBaseSku(fullSku);
    const size = item.size || extractSizeFromSku(fullSku) || 'N/A';
    const color = item.color || 'N/A';

    const updateDoc = {
      skuCode: fullSku,
      description: item.name || item.description || fullSku,
      brand: item.categoryName || item.brand || 'Uniware',
      categoryName: item.categoryName || '',
      price: item.price || item.basePrice || 0,
      basePrice: item.basePrice || item.price || 0,
      imageUrl: item.imageUrl || '',
      size: [size],
      color: [color],
    };

    await db.InventoryProduct.updateOne(
      { skuCode: fullSku },
      { $set: updateDoc },
      { upsert: true }
    );
    invProductUpdated++;
  }
  console.log(`✅ InventoryProduct synced: ${invProductUpdated} records.`);

  // 4. Update / Normalize Product collection (Grouped Base SKUs)
  console.log('🔄 Syncing Product collection (Base SKUs)...');
  const allInvProducts = await db.InventoryProduct.find({}).lean();
  let productUpdated = 0;

  // Group inventory products by base SKU
  const baseSkuGroupMap = new Map();
  allInvProducts.forEach(ip => {
    const baseSku = extractBaseSku(ip.skuCode);
    if (!baseSku) return;
    const key = baseSku.toUpperCase();
    if (!baseSkuGroupMap.has(key)) {
      baseSkuGroupMap.set(key, {
        baseSku,
        description: ip.description || baseSku,
        brand: ip.brand || 'Uniware',
        categoryName: ip.categoryName || '',
        price: ip.price || 0,
        imageUrl: ip.imageUrl || '',
        sizes: new Set(),
        colors: new Set(),
      });
    }
    const group = baseSkuGroupMap.get(key);
    if (ip.imageUrl && !group.imageUrl) group.imageUrl = ip.imageUrl;
    if (Array.isArray(ip.size)) ip.size.forEach(s => s && group.sizes.add(s));
    if (Array.isArray(ip.color)) ip.color.forEach(c => c && group.colors.add(c));
  });

  for (const [key, group] of baseSkuGroupMap.entries()) {
    const updateDoc = {
      skuCode: group.baseSku,
      description: group.description,
      brand: group.brand,
      categoryName: group.categoryName,
      price: group.price,
      imageUrl: group.imageUrl,
      size: Array.from(group.sizes),
      color: Array.from(group.colors),
    };

    await db.Product.updateOne(
      { skuCode: group.baseSku },
      { $set: updateDoc },
      { upsert: true }
    );
    productUpdated++;
  }
  console.log(`✅ Product collection synced: ${productUpdated} base SKU records.`);

  // 5. Update images in Inventory collection
  console.log('🔄 Updating image URLs in Inventory collection...');
  const inventoryItems = await db.Inventory.find({}).lean();
  let invUpdatedCount = 0;
  for (const inv of inventoryItems) {
    if (!inv.skuCode) continue;
    const fullSku = inv.skuCode.trim().toUpperCase();
    const baseSku = extractBaseSku(inv.skuCode).toUpperCase();

    let matchedImage = '';
    if (uniwareMap.has(fullSku) && uniwareMap.get(fullSku).imageUrl) {
      matchedImage = uniwareMap.get(fullSku).imageUrl;
    } else if (baseSkuImageMap.has(baseSku)) {
      matchedImage = baseSkuImageMap.get(baseSku);
    }

    if (matchedImage && inv.imageUrl !== matchedImage) {
      await db.Inventory.updateOne({ _id: inv._id }, { $set: { imageUrl: matchedImage } });
      invUpdatedCount++;
    }
  }
  console.log(`✅ Inventory collection images updated: ${invUpdatedCount} records.`);

  console.log('🎉 Catalog & Image Sync completed successfully!');
  process.exit(0);
}

runSync().catch(err => {
  console.error('❌ Migration Error:', err);
  process.exit(1);
});
