global.crypto = require('crypto');
require('dotenv').config();
const mongoose = require('mongoose');
const fabricController = require('../src/controllers/fabric.controller');

async function testYesterdayPdf() {
  try {
    const mongoUri = process.env.MONGODB_URL;
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    // Test 1: Date as YYYY-MM-DD (2026-08-09)
    console.log('\n--- TEST 1: Date YYYY-MM-DD (2026-08-09) ---');
    let req = {
      query: {
        dateStart: '2026-08-09',
        dateEnd: '2026-08-09',
        reports: 'challan,inward,outward,lotwise,stock,machine'
      }
    };
    let status = 200, dataSent = null;
    let res = {
      setHeader: () => {},
      status: (code) => { status = code; return { json: (d) => { dataSent = d; } }; },
      on: () => {}, once: () => {}, emit: () => {}, write: () => {}, end: () => {}
    };

    try {
      await fabricController.downloadFabricCombinedReportPdf(req, res);
      if (status !== 200) {
        console.error('Test 1 FAILED with status:', status, 'data:', dataSent);
      } else {
        console.log('Test 1 PASSED!');
      }
    } catch (e) {
      console.error('Test 1 Exception:', e);
    }

    // Test 2: Date with ISO times (2026-08-09T00:00:00 to 2026-08-09T23:59:59)
    console.log('\n--- TEST 2: Date with ISO time (2026-08-09T00:00:00) ---');
    req = {
      query: {
        dateStart: '2026-08-09T00:00:00',
        dateEnd: '2026-08-09T23:59:59',
        reports: 'challan,inward,outward,lotwise,stock,machine'
      }
    };
    status = 200; dataSent = null;
    try {
      await fabricController.downloadFabricCombinedReportPdf(req, res);
      if (status !== 200) {
        console.error('Test 2 FAILED with status:', status, 'data:', dataSent);
      } else {
        console.log('Test 2 PASSED!');
      }
    } catch (e) {
      console.error('Test 2 Exception:', e);
    }

    // Test 3: Date with filters (machineName, shift, operator, pass)
    console.log('\n--- TEST 3: With additional filters ---');
    req = {
      query: {
        dateStart: '2026-08-09',
        dateEnd: '2026-08-09',
        reports: 'challan,inward,outward,lotwise,stock,machine',
        machineName: 'Grando',
        shift: 'Morning',
        operator: 'John'
      }
    };
    status = 200; dataSent = null;
    try {
      await fabricController.downloadFabricCombinedReportPdf(req, res);
      if (status !== 200) {
        console.error('Test 3 FAILED with status:', status, 'data:', dataSent);
      } else {
        console.log('Test 3 PASSED!');
      }
    } catch (e) {
      console.error('Test 3 Exception:', e);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  }
}

testYesterdayPdf();
