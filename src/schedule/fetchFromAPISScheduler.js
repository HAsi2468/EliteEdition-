// src/schedule/fetchFromAPISScheduler.js
/**
 * Cron scheduler for fetchFromAPIS
 */
const cron = require('node-cron');
const { fetchFromAPIS } = require('../controllers/products.controller');

async function syncTodayData() {
  try {
    console.log('[🕛] Running fetchFromAPIS job for TODAY data...');
    const fakeReq = { query: { dateRangeText: 'TODAY' } };
    const fakeRes = {
      status: (code) => ({
        json: (payload) => console.log('[✅] TODAY fetchFromAPIS responded', code, payload?.jobCode || payload),
        send: (payload) => console.log('[✅] TODAY fetchFromAPIS responded', code, payload?.jobCode || payload)
      }),
      json: (payload) => console.log('[✅] TODAY fetchFromAPIS responded', payload?.jobCode || payload),
      send: (payload) => console.log('[✅] TODAY fetchFromAPIS responded', payload?.jobCode || payload)
    };
    await fetchFromAPIS(fakeReq, fakeRes);
  } catch (err) {
    console.error('[❌] TODAY fetchFromAPIS failed:', err.message);
  }
}

// 1. Run sync for TODAY on server startup (after 5s delay)
setTimeout(() => {
  console.log('[🚀] Triggering initial startup sync for TODAY sales orders...');
  syncTodayData();
}, 5000);

// 2. Periodic Sync for TODAY (Every 15 minutes)
cron.schedule('*/15 * * * *', async () => {
  await syncTodayData();
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
