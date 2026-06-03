const request = require('supertest');
const app = require('../app');
const fs = require('fs');

// List of endpoints to test (method, path, optional payload)
const endpoints = [
  { method: 'get', path: '/v1/products' },
  { method: 'post', path: '/v1/products', payload: {} },
  { method: 'get', path: '/v1/filters' },
  { method: 'get', path: '/v1/salesList' },
  { method: 'post', path: '/v1/auth/register', payload: { email: 'test@example.com', password: 'Pass123!', name: 'Test' } },
  { method: 'post', path: '/v1/auth/login', payload: { email: 'test@example.com', password: 'Pass123!' } },
];

const results = [];

describe('API Endpoints', () => {
  endpoints.forEach((ep) => {
    const testName = `${ep.method.toUpperCase()} ${ep.path}`;
    test(testName, async () => {
      const start = Date.now();
      let res;
      if (ep.payload) {
        res = await request(app)[ep.method](ep.path).send(ep.payload);
      } else {
        res = await request(app)[ep.method](ep.path);
      }
      const duration = Date.now() - start;
      const passed = res.status >= 200 && res.status < 400;
      results.push({ endpoint: ep.path, method: ep.method.toUpperCase(), status: res.status, duration, passed });
      expect(passed).toBe(true);
    });
  });
});

afterAll(() => {
  // Write results to a temporary JSON file for the report generator
  const outputPath = `${__dirname}/api_test_results.json`;
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
});
