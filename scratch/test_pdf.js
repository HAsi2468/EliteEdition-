require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/config');
const RawMaterialTransaction = require('../src/db/models/rawMaterialTransaction.model');
const { downloadLedgerPdf } = require('../src/controllers/rawMaterial.controller');

async function test() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to DB');

  const count = await RawMaterialTransaction.countDocuments({});
  console.log('Total RawMaterialTransaction docs in DB:', count);

  const sample = await RawMaterialTransaction.find({}).limit(5).lean();
  console.log('Sample docs:', sample);

  const req = {
    query: {
      dateStart: '2026-09-01',
      dateEnd: '2026-09-12',
      type: 'INWARD',
      materialName: 'Ink'
    }
  };

  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    pipe() {},
    on() {},
    once() {},
    emit() {},
    write(chunk) { console.log('Wrote PDF chunk size:', chunk ? chunk.length : 0); },
    end() { console.log('Response ended successfully!'); },
    status(code) {
      console.log('Status code:', code);
      return this;
    },
    json(data) {
      console.log('JSON response:', data);
    }
  };

  try {
    await downloadLedgerPdf(req, res);
  } catch (e) {
    console.error('Caught error during PDF generation:', e);
  } finally {
    await mongoose.disconnect();
  }
}

test();
