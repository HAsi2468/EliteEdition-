// src/schedule/fetchFromAPISScheduler.js
/**
 * Cron scheduler for fetchFromAPIS
 */
const cron = require('node-cron');
const { fetchFromAPIS } = require('../controllers/products.controller');

// 1. Hourly Sync for TODAY (Every hour at the 55th minute)
cron.schedule('55 * * * *', async () => {
  try {
    console.log('[🕛] Running HOURLY fetchFromAPIS job for TODAY data (At 55th minute)');
    const fakeReq = { query: { dateRangeText: 'TODAY' } };
    const fakeRes = {
      status: (code) => ({
        json: (payload) => console.log('[✅] HOURLY fetchFromAPIS responded', code, payload),
        send: (payload) => console.log('[✅] HOURLY fetchFromAPIS responded', code, payload)
      }),
      json: (payload) => console.log('[✅] HOURLY fetchFromAPIS responded', payload),
      send: (payload) => console.log('[✅] HOURLY fetchFromAPIS responded', payload)
    };
    await fetchFromAPIS(fakeReq, fakeRes);
  } catch (err) {
    console.error('[❌] HOURLY fetchFromAPIS failed:', err);
  }
});

// 2. 2-Hourly Sync for LAST_90_DAYS (Every 2 hours at the 10th minute)
cron.schedule('10 */2 * * *', async () => {
  try {
    console.log('[🕛] Running periodic fetchFromAPIS job for LAST_90_DAYS data (Every 2 hours at 10th minute)');
    const fakeReq = { query: { dateRangeText: 'LAST_90_DAYS' } };
    const fakeRes = {
      status: (code) => ({
        json: (payload) => console.log('[✅] Periodic fetchFromAPIS responded', code, payload),
        send: (payload) => console.log('[✅] Periodic fetchFromAPIS responded', code, payload)
      }),
      json: (payload) => console.log('[✅] Periodic fetchFromAPIS responded', payload),
      send: (payload) => console.log('[✅] Periodic fetchFromAPIS responded', payload)
    };
    await fetchFromAPIS(fakeReq, fakeRes);
  } catch (err) {
    console.error('[❌] Periodic fetchFromAPIS failed:', err);
  }
});

console.log('[🕒] Schedulers initialized for fetchFromAPIS:');
console.log('      - Hourly TODAY Sync (cron: 55 * * * *)');
console.log('      - 2-hourly LAST_90_DAYS Sync (cron: 10 */2 * * * starting at 12:10 AM)');

module.exports = {};
