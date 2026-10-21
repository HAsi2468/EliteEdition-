import http from 'k6/http';
import { check, sleep, group } from 'k6';

/**
 * ELITE EDITION ERP - 40 CONCURRENT USER LOAD TEST SUITE
 * 
 * Usage:
 *   k6 run scripts/k6_load_test.js
 *   k6 run -e TARGET_URL="https://erp.eliteedition.in" -e TOKEN="your_jwt_token_here" scripts/k6_load_test.js
 */

export const options = {
  stages: [
    { duration: '20s', target: 10 }, // Phase 1: Warm up to 10 VUs
    { duration: '30s', target: 20 }, // Phase 2: Steady state at 20 VUs
    { duration: '1m',  target: 40 }, // Phase 3: High concurrency peak at 40 VUs
    { duration: '30s', target: 40 }, // Phase 4: Peak soak testing 40 VUs
    { duration: '20s', target: 0 },  // Phase 5: Graceful cool down
  ],
  thresholds: {
    // Under 40 concurrent users, error rate must remain under 2% (was 78% prior to cluster & index fixes)
    http_req_failed: ['rate<0.02'],
    // 95% of queries must resolve within 1.5 seconds
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://erp.eliteedition.in/v1';
const AUTH_TOKEN = __ENV.TOKEN || '';

const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'k6-load-runner-node-01',
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
};

export default function () {
  const headers = getHeaders();

  group('01_Operations_Dashboard', () => {
    // 1. Daily Operations Summary (Heavy aggregation testing)
    const summaryRes = http.get(`${BASE_URL}/digital-print-dashboard/daily-summary`, { headers });
    check(summaryRes, {
      'Dashboard Summary Status 200': (r) => r.status === 200,
      'Dashboard Response Time < 1500ms': (r) => r.timings.duration < 1500,
    });
  });

  sleep(1);

  group('02_JobCards_Pipeline', () => {
    // 2. Job Card Registry (Paged listing with status filter)
    const jcRes = http.get(`${BASE_URL}/jobCards?page=1&limit=25&department=digital_print`, { headers });
    check(jcRes, {
      'JobCards Listing Status 200': (r) => r.status === 200,
      'JobCards Response Time < 1200ms': (r) => r.timings.duration < 1200,
    });
  });

  sleep(1);

  group('03_Fabric_Management', () => {
    // 3. Fabric Challans Listing
    const fabricRes = http.get(`${BASE_URL}/fabric-challan?page=1&limit=20`, { headers });
    check(fabricRes, {
      'Fabric Challans Status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
  });

  sleep(2);
}
