/**
 * Test Suite: Digital QR Code Verification on Physical Delivery Challan PDFs (Phase 3)
 * Verifies QR buffer generation, public HTML & JSON verification responses, and counterfeit defense.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  generateChallanQrBuffer,
  renderValidChallanHtml,
  renderInvalidChallanHtml,
  verifyChallan,
} = require('../controllers/challanVerification.controller');

describe('Phase 3: Digital QR Code Verification on Physical Delivery Challan PDFs', () => {
  describe('1. QR Code Buffer Generation', () => {
    it('should generate a high-resolution PNG image buffer for a verification UUID', async () => {
      const testUuid = 'e8b8c8d8-1234-5678-9abc-def012345678';
      const buffer = await generateChallanQrBuffer(testUuid, 'https://erp.eliteedition.in');

      assert.ok(Buffer.isBuffer(buffer), 'Result must be a binary Buffer');
      assert.ok(buffer.length > 500, 'Buffer must contain image data');
      // PNG magic bytes header: 0x89 0x50 0x4E 0x47
      assert.strictEqual(buffer[0], 0x89);
      assert.strictEqual(buffer[1], 0x50);
      assert.strictEqual(buffer[2], 0x4E);
      assert.strictEqual(buffer[3], 0x47);
    });
  });

  describe('2. Responsive Verification HTML Viewports', () => {
    it('should render authentic challan verification HTML with security stamp and party data', () => {
      const sampleData = {
        challanNo: 750,
        formattedNo: 'EDP-750',
        partyName: 'Shree Krishna Silks',
        fabricName: 'KOHINOOR LINEN 58',
        totalMtr: 620.5,
        totalTp: 15,
        status: 'INVOICED',
        formattedDate: '30 Sep 2026',
        verificationHash: 'a1b2c3d4e5f60718',
        verificationScanCount: 3,
      };

      const html = renderValidChallanHtml(sampleData);
      assert.ok(html.includes('GENUINE OFFICIAL CHALLAN'));
      assert.ok(html.includes('EDP-750'));
      assert.ok(html.includes('Shree Krishna Silks'));
      assert.ok(html.includes('620.5 Meters'));
      assert.ok(html.includes('15 Rolls'));
      assert.ok(html.includes('a1b2c3d4e5f60718'));
      assert.ok(html.includes('Total Scans: 3'));
    });

    it('should render invalid or counterfeit warning HTML when token is unknown', () => {
      const fakeUuid = 'fake-token-attempt-999';
      const html = renderInvalidChallanHtml(fakeUuid);

      assert.ok(html.includes('INVALID OR COUNTERFEIT CHALLAN'));
      assert.ok(html.includes('Document Not Recognized'));
      assert.ok(html.includes(fakeUuid));
    });
  });

  describe('3. Public Verification Endpoint Express Harness', () => {
    const mockDb = {
      'valid-uuid-1234': {
        challanNo: 701,
        verificationUuid: 'valid-uuid-1234',
        partyName: 'Royal Textile Exports',
        fabricName: 'FRENCH CREPE 58',
        totalMtr: 850,
        totalTp: 20,
        pcs: 20,
        status: 'PENDING',
        verificationHash: '9876abcdef123456',
        verificationScanCount: 0,
        date: new Date('2026-09-30T00:00:00.000Z'),
        save: async function () {
          this.verificationScanCount++;
          return this;
        },
      },
    };

    function createVerificationTestApp() {
      const app = express();
      app.use(express.json());

      // Mock verify endpoint using mockDb
      app.get('/verify/challan/:uuid', async (req, res) => {
        const { uuid } = req.params;
        const challan = mockDb[uuid];

        if (!challan) {
          if (req.accepts('html') && !req.accepts('json')) {
            return res.status(404).send(renderInvalidChallanHtml(uuid));
          }
          return res.status(404).json({
            success: false,
            verified: false,
            error: 'CHALLAN_NOT_FOUND',
            message: 'Invalid or counterfeit challan.',
          });
        }

        await challan.save();

        if (req.accepts('html') && !req.accepts('json')) {
          return res.status(200).send(
            renderValidChallanHtml({
              ...challan,
              formattedNo: `EDP-${challan.challanNo}`,
              formattedDate: '30 Sep 2026',
            })
          );
        }

        res.json({
          success: true,
          verified: true,
          data: {
            challanNo: challan.challanNo,
            formattedNo: `EDP-${challan.challanNo}`,
            partyName: challan.partyName,
            totalMtr: challan.totalMtr,
            verificationScanCount: challan.verificationScanCount,
          },
        });
      });

      return app;
    }

    const testApp = createVerificationTestApp();

    it('should return authentic verification JSON when valid UUID is queried', async () => {
      const res = await request(testApp)
        .get('/verify/challan/valid-uuid-1234')
        .set('Accept', 'application/json')
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.verified, true);
      assert.strictEqual(res.body.data.formattedNo, 'EDP-701');
      assert.strictEqual(res.body.data.partyName, 'Royal Textile Exports');
      assert.strictEqual(res.body.data.totalMtr, 850);
      assert.strictEqual(res.body.data.verificationScanCount, 1);
    });

    it('should return 404 when unverified UUID is scanned', async () => {
      const res = await request(testApp)
        .get('/verify/challan/tampered-or-unknown-uuid')
        .set('Accept', 'application/json')
        .expect(404);

      assert.strictEqual(res.body.verified, false);
      assert.strictEqual(res.body.error, 'CHALLAN_NOT_FOUND');
    });

    it('should return styled HTML page when smartphone browser scans QR code (Accept: text/html)', async () => {
      const res = await request(testApp)
        .get('/verify/challan/valid-uuid-1234')
        .set('Accept', 'text/html')
        .expect(200);

      assert.ok(res.text.includes('GENUINE OFFICIAL CHALLAN'));
      assert.ok(res.text.includes('Royal Textile Exports'));
    });
  });
});
