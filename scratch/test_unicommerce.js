require('../src/polyfills/crypto');
const { getAccessToken, fetchProductData } = require('../src/services/api.service');

async function run() {
  console.log('Fetching access token...');
  const token = await getAccessToken();
  console.log('Token fetched:', token ? 'SUCCESS' : 'FAILED');
  if (!token) return;

  const testSKUs = ['273', '273_M', '301', '301_L', '212', '212_L', 'AC20505_M'];
  for (const sku of testSKUs) {
    try {
      console.log(`\n--- Fetching for SKU: ${sku} ---`);
      const res = await fetchProductData(sku, token);
      console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e) {
      console.error(`Error for SKU ${sku}:`, e.message);
    }
  }
}

run();
