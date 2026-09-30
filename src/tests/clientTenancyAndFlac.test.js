/**
 * Test Suite: Client Tenancy Guard & Field-Level Access Control (FLAC)
 * Verifies Row-Level Security, Tenant Pinning, Cross-Party Defense, and Field Redaction.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  clientTenancyGuard,
  verifyRecordOwnership,
  extractClientIdentity,
  isPartyAllowedForClient,
  requireAdmin,
  guardClientSelfAccess,
} = require('../middlewares/clientTenancyGuard');

const {
  fieldLevelSanitizer,
  sanitizeFields,
  CLIENT_RESTRICTED_FIELDS,
  OPERATOR_RESTRICTED_FIELDS,
} = require('../middlewares/fieldLevelSanitizer');

// In-memory mock database of sample records for testing
const mockJobCards = {
  '650000000000000000000001': {
    _id: '650000000000000000000001',
    jobNo: 'JC-1001',
    party: 'Aditi Fashions',
    designNo: 'ED-991',
    fabric: 'KOHINOOR LINEN 58',
    totalMtr: '500',
    pcs: '25',
    status: 'Pending',
    printStatus: 'Printing Pending',
    // Sensitive costing
    costPerMeter: 12.5,
    unitPricePerSqFt: 4.2,
    totalCalculatedCost: 6250,
    margin: 35,
    // Sensitive internal notes
    note1: 'Internal: Operator check nozzle alignment before run',
    emergencyNotes: 'Client is demanding express dispatch',
    // Machine calibration
    temperature: '210C',
    speed: '120m/h',
    // Operator restricted financials
    ratePerMeter: 45,
    totalAmount: 22500,
    billNo: 'INV-2026-088',
    paymentStatus: 'UNPAID',
  },
  '650000000000000000000002': {
    _id: '650000000000000000000002',
    jobNo: 'JC-1002',
    party: 'Competitor Silk Mills',
    designNo: 'ED-882',
    fabric: 'FRENCH CREPE 58',
    totalMtr: '1200',
    status: 'Pending',
    costPerMeter: 15.0,
    totalCalculatedCost: 18000,
    ratePerMeter: 55,
    totalAmount: 66000,
  },
};

// Build isolated test app
function createTenancyTestApp() {
  const app = express();
  app.use(express.json());

  // Attach mock user based on headers
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'];
    const party = req.headers['x-test-party'];
    const id = req.headers['x-test-id'] || '65client0000000000000001';

    if (role === 'Client') {
      req.user = {
        _id: id,
        id,
        role: 'Client',
        isClient: true,
        companyName: party || 'Aditi Fashions',
        companyCode: 'ADTI',
        username: 'aditi_user',
        mobile: '9876543210',
      };
      req.isClient = true;
    } else if (role === 'operator') {
      req.user = {
        _id: '65operator0000000000001',
        role: 'operator',
        name: 'Floor Operator 1',
      };
    } else if (role === 'admin') {
      req.user = {
        _id: '65admin000000000000001',
        role: 'admin',
        isMainAdmin: true,
        name: 'System Admin',
      };
    }
    next();
  });

  // Apply FLAC Sanitizer
  app.use(fieldLevelSanitizer);

  // Protected job cards router with tenancy guard
  const jcRouter = express.Router();
  jcRouter.use(clientTenancyGuard);

  // List job cards
  jcRouter.get('/', (req, res) => {
    const requestedParty = req.query.party;
    const cards = Object.values(mockJobCards).filter((c) =>
      requestedParty ? c.party === requestedParty : true
    );
    res.json({ success: true, count: cards.length, data: cards, queryParty: req.query.party });
  });

  // Create job card
  jcRouter.post('/', (req, res) => {
    res.status(201).json({
      success: true,
      created: req.body,
    });
  });

  // Delete job card
  jcRouter.delete('/:id', (req, res) => {
    res.json({ success: true, message: 'Deleted' });
  });

  // Single job card lookup with record ownership guard
  jcRouter.get('/:id', (req, res) => {
    const card = mockJobCards[req.params.id];
    if (!card) return res.status(404).json({ error: 'Not found' });

    // Enforce ownership if client
    const identity = extractClientIdentity(req);
    if (identity && !isPartyAllowedForClient(card.party, identity)) {
      return res.status(403).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied: You do not own this record.',
      });
    }

    res.json({ success: true, data: card });
  });

  // Admin restricted utility
  jcRouter.post('/reset-all', (req, res) => {
    res.json({ success: true, message: 'Reset all complete' });
  });

  app.use('/api/job-cards', jcRouter);

  // Client accounts management routes
  const clientRouter = express.Router();
  clientRouter.get('/', requireAdmin, (req, res) => {
    res.json({ success: true, clients: [{ name: 'Aditi Fashions' }, { name: 'Competitor' }] });
  });
  clientRouter.get('/:id', guardClientSelfAccess, (req, res) => {
    res.json({ success: true, client: { id: req.params.id } });
  });
  app.use('/api/clients', clientRouter);

  return app;
}

describe('Phase 1: Client Tenancy Guard & Field-Level Access Control (FLAC)', () => {
  const app = createTenancyTestApp();

  describe('1. Client Identity & Tenant Pinning (Row-Level Security)', () => {
    it('should automatically pin req.query.party to client company when querying job cards', async () => {
      const res = await request(app)
        .get('/api/job-cards')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.queryParty, 'Aditi Fashions');
      // Should strictly only return records for Aditi Fashions
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].party, 'Aditi Fashions');
    });

    it('should immediately reject cross-tenant party filter with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/job-cards?party=Competitor%20Silk%20Mills')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(403);

      assert.strictEqual(res.body.error, 'TENANT_ISOLATION_VIOLATION');
      assert.strictEqual(res.body.code, 'CROSS_PARTY_ACCESS_DENIED');
    });

    it('should block client attempt to inject unauthorized party into request body with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/job-cards')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .send({
          jobNo: 'JC-NEW-99',
          party: 'Competitor Silk Mills',
          totalMtr: '400',
        })
        .expect(403);

      assert.strictEqual(res.body.error, 'TENANT_ISOLATION_VIOLATION');
      assert.strictEqual(res.body.code, 'CROSS_PARTY_MUTATION_DENIED');
    });

    it('should allow valid client creation and invariantly pin party and creator metadata', async () => {
      const res = await request(app)
        .post('/api/job-cards')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .send({
          jobNo: 'JC-CLIENT-01',
          party: 'Aditi Fashions',
          totalMtr: '250',
        })
        .expect(201);

      assert.strictEqual(res.body.created.party, 'Aditi Fashions');
      assert.strictEqual(res.body.created.createdBy, 'Client (Aditi Fashions)');
    });

    it('should block client from calling DELETE on production records with HTTP 403', async () => {
      const res = await request(app)
        .delete('/api/job-cards/650000000000000000000001')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(403);

      assert.strictEqual(res.body.error, 'TENANT_ISOLATION_VIOLATION');
      assert.strictEqual(res.body.code, 'METHOD_NOT_ALLOWED_FOR_CLIENT');
    });

    it('should block client from accessing administrative reset-all utility with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/job-cards/reset-all')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(403);

      assert.strictEqual(res.body.error, 'TENANT_ISOLATION_VIOLATION');
      assert.strictEqual(res.body.code, 'ADMIN_ROUTE_RESTRICTED');
    });

    it('should allow administrators to access all parties without restriction', async () => {
      const res = await request(app)
        .get('/api/job-cards')
        .set('x-test-role', 'admin')
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 2);
    });
  });

  describe('2. Single-Record Ownership Protection', () => {
    it('should allow a client to retrieve their own job card by ID', async () => {
      const res = await request(app)
        .get('/api/job-cards/650000000000000000000001')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.jobNo, 'JC-1001');
    });

    it('should block a client from retrieving another party’s job card by ID with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/job-cards/650000000000000000000002') // Belongs to Competitor Silk Mills
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(403);

      assert.strictEqual(res.body.error, 'TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('3. Client Profile & Account Isolation', () => {
    it('should block client from listing all client directory records with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(403);

      assert.strictEqual(res.body.code, 'ADMIN_PRIVILEGE_REQUIRED');
    });

    it('should allow client to access their own account details by ID or username', async () => {
      const res = await request(app)
        .get('/api/clients/65client0000000000000001')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .set('x-test-id', '65client0000000000000001')
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });

    it('should block client from sniffing another client account by ID with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/clients/65otherclient99999999999')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .set('x-test-id', '65client0000000000000001')
        .expect(403);

      assert.strictEqual(res.body.code, 'CLIENT_PROFILE_FORBIDDEN');
    });
  });

  describe('4. Field-Level Access Control (FLAC) Projection Sanitizer', () => {
    it('should strip costing rates, gross margins, internal notes, and machine calibrations for Clients', async () => {
      const res = await request(app)
        .get('/api/job-cards/650000000000000000000001')
        .set('x-test-role', 'Client')
        .set('x-test-party', 'Aditi Fashions')
        .expect(200);

      const card = res.body.data;
      // Verified public fields
      assert.strictEqual(card.jobNo, 'JC-1001');
      assert.strictEqual(card.totalMtr, '500');
      assert.strictEqual(card.pcs, '25');
      assert.strictEqual(card.status, 'Pending');

      // Sensitive costing fields MUST be deleted
      assert.strictEqual(card.costPerMeter, undefined);
      assert.strictEqual(card.unitPricePerSqFt, undefined);
      assert.strictEqual(card.totalCalculatedCost, undefined);
      assert.strictEqual(card.margin, undefined);

      // Sensitive internal notes MUST be deleted
      assert.strictEqual(card.note1, undefined);
      assert.strictEqual(card.emergencyNotes, undefined);

      // Machine configurations MUST be deleted
      assert.strictEqual(card.temperature, undefined);
      assert.strictEqual(card.speed, undefined);
    });

    it('should strip financial rates and invoices for Floor Operators while preserving machine specs', async () => {
      const res = await request(app)
        .get('/api/job-cards/650000000000000000000001')
        .set('x-test-role', 'operator')
        .expect(200);

      const card = res.body.data;
      // Floor operators NEED production parameters
      assert.strictEqual(card.jobNo, 'JC-1001');
      assert.strictEqual(card.totalMtr, '500');
      assert.strictEqual(card.temperature, '210C');
      assert.strictEqual(card.speed, '120m/h');
      assert.strictEqual(card.note1, 'Internal: Operator check nozzle alignment before run');

      // Floor operators MUST NOT see billing, invoices, and payment data
      assert.strictEqual(card.ratePerMeter, undefined);
      assert.strictEqual(card.totalAmount, undefined);
      assert.strictEqual(card.billNo, undefined);
      assert.strictEqual(card.paymentStatus, undefined);
    });

    it('should preserve 100% full fidelity without any redaction for Administrators', async () => {
      const res = await request(app)
        .get('/api/job-cards/650000000000000000000001')
        .set('x-test-role', 'admin')
        .expect(200);

      const card = res.body.data;
      // Admin sees both costing, notes, machine calibrations, and billing
      assert.strictEqual(card.costPerMeter, 12.5);
      assert.strictEqual(card.totalCalculatedCost, 6250);
      assert.strictEqual(card.note1, 'Internal: Operator check nozzle alignment before run');
      assert.strictEqual(card.temperature, '210C');
      assert.strictEqual(card.totalAmount, 22500);
      assert.strictEqual(card.paymentStatus, 'UNPAID');
    });

    it('should sanitize credentials (password, salt, hash) directly via sanitizeFields helper', () => {
      const dirtyObj = {
        username: 'client_xyz',
        password: 'PlainPassword123!',
        salt: 'abc123salt',
        costPerMeter: 10,
        normalField: 'ok',
      };
      const cleaned = sanitizeFields(dirtyObj, CLIENT_RESTRICTED_FIELDS);
      assert.strictEqual(cleaned.password, undefined);
      assert.strictEqual(cleaned.salt, undefined);
      assert.strictEqual(cleaned.costPerMeter, undefined);
      assert.strictEqual(cleaned.username, 'client_xyz');
      assert.strictEqual(cleaned.normalField, 'ok');
    });
  });
});
