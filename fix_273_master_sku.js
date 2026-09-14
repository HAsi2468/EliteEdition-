const db = require('./src/db/models');

async function migrate273ToMasterSku() {
  try {
    console.log('🚀 Fixing 273 Master SKU and linking brand barcodes...');

    const brandCodesFor273XL = [
      { brand: 'ANOUK', code: 'SNGRKASS139632546', size: 'XL' },
      { brand: 'ANOUK', code: 'ANUKKASS130011654', size: 'XL' }
    ];

    // 1. Update Product 273_XL catalog entries with brandCodes
    await db.Product.updateMany(
      { skuCode: { $in: ['273_XL', '273', 'A-273_XL', 'S-273_XL'] } },
      { $addToSet: { brandCodes: { $each: brandCodesFor273XL } } }
    );

    await db.InventoryProduct.updateMany(
      { skuCode: { $in: ['273_XL', '273', 'A-273_XL', 'S-273_XL'] } },
      { $addToSet: { brandCodes: { $each: brandCodesFor273XL } } }
    );

    // 2. Migrate existing db.Inventory records with brand barcodes to 273_XL
    const barcodesToMigrate = ['SNGRKASS139632546', 'ANUKKASS130011654'];
    
    const oldRecords = await db.Inventory.find({ skuCode: { $in: barcodesToMigrate } }).lean();
    console.log(`Found ${oldRecords.length} old inventory records with brand barcodes.`);

    let totalQtyToMerge = 0;
    let sampleParty = 'ANOUK';
    let sampleBuyPrice = 0;
    let sampleSellPrice = 0;
    let sampleChallan = '';

    oldRecords.forEach(r => {
      totalQtyToMerge += (r.qty || 0);
      sampleParty = r.party || sampleParty;
      sampleBuyPrice = r.purchasePrice || sampleBuyPrice;
      sampleSellPrice = r.salePrice || sampleSellPrice;
      sampleChallan = r.challanNo || sampleChallan;
    });

    // Delete the unmapped brand barcode inventory rows
    await db.Inventory.deleteMany({ skuCode: { $in: barcodesToMigrate } });

    // Check if 273_XL inventory row already exists
    let masterInvRow = await db.Inventory.findOne({ skuCode: '273_XL' });
    if (masterInvRow) {
      masterInvRow.qty = (masterInvRow.qty || 0) + totalQtyToMerge;
      masterInvRow.currentlyAvailableStock = masterInvRow.qty;
      await masterInvRow.save();
      console.log(`Updated existing 273_XL inventory row! New Qty: ${masterInvRow.qty}`);
    } else if (totalQtyToMerge > 0) {
      const newInvRow = await db.Inventory.create({
        skuCode: '273_XL',
        itemName: '273_XL',
        party: sampleParty,
        size: 'XL',
        qty: totalQtyToMerge,
        currentlyAvailableStock: totalQtyToMerge,
        purchasePrice: sampleBuyPrice,
        salePrice: sampleSellPrice,
        challanNo: sampleChallan,
        brandCodes: brandCodesFor273XL,
        date: new Date()
      });
      console.log(`Created new 273_XL inventory row! Qty: ${newInvRow.qty}`);
    }

    console.log('✅ 273 Master SKU Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
}

migrate273ToMasterSku();
