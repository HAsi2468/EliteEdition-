// src/schedule/fetchFromAPISScheduler.js
/**
 * Hourly scheduler for fetchFromAPIS using native timers with countdown logger
 */
const { fetchFromAPIS } = require('../controllers/products.controller');

let nextRunTime = null;

function getNextScheduledTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  let next = new Date(now);
  next.setMinutes(55, 0, 0);
  if (minutes >= 55) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

function startCountdownLogger() {
  setInterval(() => {
    if (!nextRunTime) return;
    const now = new Date();
    const diffMs = nextRunTime - now;
    if (diffMs > 0) {
      const diffSeconds = Math.round(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      console.log(`[⏱️] NEXT AUTOMATIC API RUN IN: ${minutes} minutes and ${seconds} seconds (at ${nextRunTime.toLocaleTimeString()})`);
    } else {
      console.log(`[⏱️] NEXT AUTOMATIC API RUN IS IMMINENT (firing now...)`);
    }
  }, 60 * 1000); // Log every 1 minute
}

function scheduleHourlyFetch() {
  nextRunTime = getNextScheduledTime();
  const now = new Date();
  const delay = nextRunTime - now;

  const diffSeconds = Math.round(delay / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  console.log(`[🕒] Scheduling first fetchFromAPIS in ${minutes} minutes and ${seconds} seconds (Next run: ${nextRunTime.toLocaleTimeString()})`);

  setTimeout(async () => {
    // Set next run time before executing job, to ensure correct countdown tracking
    nextRunTime = new Date(Date.now() + 60 * 60 * 1000);
    await runJob();

    // After first execution, repeat every hour
    setInterval(async () => {
      nextRunTime = new Date(Date.now() + 60 * 60 * 1000);
      await runJob();
    }, 60 * 60 * 1000);
  }, delay);

  // Start the countdown logger to print remaining time every minute
  startCountdownLogger();
}

async function runJob() {
  try {
    console.log('[🕛] Running hourly fetchFromAPIS job');
    const fakeReq = {};
    const fakeRes = {
      status: (code) => ({
        json: (payload) => console.log('[✅] fetchFromAPIS responded', code, payload),
        send: (payload) => console.log('[✅] fetchFromAPIS responded', code, payload)
      }),
      json: (payload) => console.log('[✅] fetchFromAPIS responded', payload),
      send: (payload) => console.log('[✅] fetchFromAPIS responded', payload)
    };
    await fetchFromAPIS(fakeReq, fakeRes);
  } catch (err) {
    console.error('[❌] Hourly fetchFromAPIS failed:', err);
  }
}

// Initialize the scheduler
scheduleHourlyFetch();

// -------------------------------------------------------------
// NIGHTLY SCHEDULE (2:15 AM)
// Fetches data for 'YESTERDAY' to ensure complete end-of-day data is retrieved
// -------------------------------------------------------------
const cron = require('node-cron');

cron.schedule('10 0 * * *', async () => {
  try {
    console.log('[🕛] Running NIGHTLY fetchFromAPIS job for YESTERDAY data (12:10 AM)');
    const fakeReq = { query: { dateRangeText: 'YESTERDAY' } };
    const fakeRes = {
      status: (code) => ({
        json: (payload) => console.log('[✅] NIGHTLY fetchFromAPIS responded', code, payload),
        send: (payload) => console.log('[✅] NIGHTLY fetchFromAPIS responded', code, payload)
      }),
      json: (payload) => console.log('[✅] NIGHTLY fetchFromAPIS responded', payload),
      send: (payload) => console.log('[✅] NIGHTLY fetchFromAPIS responded', payload)
    };
    await fetchFromAPIS(fakeReq, fakeRes);
  } catch (err) {
    console.error('[❌] NIGHTLY fetchFromAPIS failed:', err);
  }
});

module.exports = {};
