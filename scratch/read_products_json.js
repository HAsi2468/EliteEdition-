const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../products.json');
try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log('Type of data:', Array.isArray(data) ? 'Array' : typeof data);
  console.log('Length/Size:', data.length);
  if (Array.isArray(data) && data.length > 0) {
    console.log('First item keys:', Object.keys(data[0]));
    console.log('First item example:', JSON.stringify(data[0], null, 2));
    
    // Filter matches for 301
    const matches301 = data.filter(item => {
      const sku = item['Item SKU Code'] || '';
      return sku.toString().includes('301');
    });
    console.log('Total 301 records:', matches301.length);
    if (matches301.length > 0) {
      console.log('Fields populated in first 5 matching 301 orders:');
      matches301.slice(0, 5).forEach((item, index) => {
        console.log(`[Order ${index + 1}] SKU: ${item['Item SKU Code']} | Name: ${item['Item Type Name']} | Brand: ${item['Item Type Brand']} | Color: ${item['Item Type Color']} | Size: ${item['Item Type Size']} | MRP: ${item['MRP']} | Total Price: ${item['Total Price']}`);
      });
      
      // Let's check if ANY 301 order has non-empty Brand or Color or MRP
      const withBrand = matches301.filter(item => item['Item Type Brand'] && item['Item Type Brand'].trim() !== '');
      const withColor = matches301.filter(item => item['Item Type Color'] && item['Item Type Color'].trim() !== '');
      const withMRP = matches301.filter(item => item['MRP'] && item['MRP'].trim() !== '');
      console.log('301 with Brand:', withBrand.length);
      console.log('301 with Color:', withColor.length);
      console.log('301 with MRP:', withMRP.length);
    }
  }
} catch (e) {
  console.error('Error reading products.json:', e);
}
