const db = require('../src/db/models');

async function autoLinkAndFixMasterSkus() {
  try {
    console.log('🚀 Starting Brand Barcode to Master SKU Auto-Link & Migration...');

    // 1. Fetch all products from db.Product and db.InventoryProduct
    const catalogProducts = await db.Product.find({}).lean();
    const invProducts = await db.InventoryProduct.find({}).lean();

    const allProducts = [...catalogProducts, ...invProducts];

    // Helper to extract design base number (e.g. "273_L" -> "273", "A-273_M" -> "273", "SNGRKASS139632546" -> image search "273")
    function extractDesignNum(p) {
      if (!p) return '';
      const sku = (p.skuCode || '').trim();
      const img = (p.imageUrl || '').trim();

      // Check image URL for pattern e.g. /273_L.jpg or /273_
      const imgMatch = img.match(/[\/_](\d{2,5})[-_]/i) || img.match(/[\/_](\d{2,5})\./i);
      if (imgMatch) return imgMatch[1];

      // Check SKU pattern e.g. 273_L, A-273_M, 273
      const skuMatch = sku.match(/^(?:[A-Z]-)?(\d{2,5})(?:[-_]|$)/i);
      if (skuMatch) return skuMatch[1];

      return '';
    }

    // Group products by design number
    const designMap = new Map();
    allProducts.forEach(p => {
      const designNum = extractDesignNum(p);
      if (designNum) {
        if (!designMap.has(designNum)) designMap.set(designNum, []);
        designMap.get(designNum).push(p);
      }
    });

    console.log(`Found ${designMap.size} design clusters.`);

    // 2. For each design cluster, identify master SKU and link brand barcodes
    let brandCodesAdded = 0;
    let inventoryMigrated = 0;

    for (const [designNum, prods] of designMap.entries()) {
      const brandCodesToLink = [];

      prods.forEach(p => {
        const sku = (p.skuCode || '').trim();
        const sizeStr = Array.isArray(p.size) ? p.size[0] : (p.size || 'XL');

        // If SKU looks like a long brand barcode (e.g. SNGRKASS..., ANUKKASS..., length > 12)
        if (sku.length >= 10 && !sku.includes('-') && !sku.includes('_')) {
          brandCodesToLink.push({
            brand: p.brand || 'ANOUK',
            code: sku,
            size: (sizeStr || 'XL').toUpperCase()
          });
        }
      });

      if (brandCodesToLink.length > 0) {
        console.log(`Design ${designNum}: Found ${brandCodesToLink.length} brand barcodes to link:`, brandCodesToLink.map(b => b.code));

        // Update all Master Products in this design cluster with these brandCodes
        for (const p of prods) {
          const sku = (p.skuCode || '').trim();
          // Master products are those with standard design SKU format like 273_L, 273_XL, 273, A-273_M
          if (sku.includes(designNum) && (sku.length < 10 || sku.includes('_') || sku.includes('-'))) {
            const existingCodes = p.brandCodes || [];
            const mergedCodes = [...existingCodes];

            brandCodesToLink.forEach(bc => {
              const exists = mergedCodes.some(c => (typeof c === 'string' ? c === bc.code : c.code === bc.code));
              if (!exists) {
                mergedCodes.push(bc);
                brandCodesAdded++;
              }
            });

            await db.Product.updateOne({ _id: p._id }, { $set: { brandCodes: mergedCodes } }).catch(() => {});
            await db.InventoryProduct.updateOne({ _id: p._id }, { $set: { brandCodes: mergedCodes } }).catch(() => {});
          }
        }

        // 3. Migrate existing db.Inventory stock entries with brand barcode skuCode to Master SKU
        for (const bc of brandCodesToLink) {
          const masterSkuCandidate = `${designNum}_${bc.size}`;
          const invMatch = await db.Inventory.find({ skuCode: bc.code }).lean();

          if (invMatch.length > 0) {
            console.log(`Migrating ${invMatch.length} inventory records with skuCode "${bc.code}" ➔ "${masterSkuCandidate}"`);
            await db.Inventory.updateMany(
              { skuCode: bc.code },
              { $set: { skuCode: masterSkuCandidate, itemName: masterSkuCandidate } }
            );
            inventoryMigrated += invMatch.length;
          }
        }
      }
    }

    console.log(`✅ AUTO-LINK COMPLETE! Added ${brandCodesAdded} brand codes, migrated ${inventoryMigrated} inventory records to Master SKUs.`);
    process.exit(0);
  } catch (err) {
    console.error('Error during auto-link migration:', err);
    process.exit(1);
  }
}

autoLinkAndFixMasterSkus();
