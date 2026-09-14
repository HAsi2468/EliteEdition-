const db = require('./src/db/models');

async function checkDesign() {
  try {
    const products = await db.Product.find({
      $or: [
        { skuCode: /273/i },
        { skuCode: /SNGRKASS/i },
        { skuCode: /ANUKKASS/i },
        { 'brandCodes.code': /SNGRKASS/i },
        { 'brandCodes.code': /ANUKKASS/i }
      ]
    }).lean();

    console.log('--- PRODUCTS CATALOG (db.Product) ---');
    console.log(JSON.stringify(products, null, 2));

    const invProducts = await db.InventoryProduct.find({
      $or: [
        { skuCode: /273/i },
        { skuCode: /SNGRKASS/i },
        { skuCode: /ANUKKASS/i },
        { 'brandCodes.code': /SNGRKASS/i },
        { 'brandCodes.code': /ANUKKASS/i }
      ]
    }).lean();

    console.log('--- INVENTORY PRODUCTS (db.InventoryProduct) ---');
    console.log(JSON.stringify(invProducts, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDesign();
