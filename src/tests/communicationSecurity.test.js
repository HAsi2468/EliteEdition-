const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');
const { requireAdmin, requireAuth, requireGroupAccess } = require('../middlewares/auth.middleware');

describe('Communication & Chat Security Test Suite', () => {

  describe('1. XSS Sanitization & Content Armor', () => {
    it('should strip <script> tags and embedded javascript execution', () => {
      const payload = 'Hello world <script>alert("XSS")</script> how are you?';
      const result = sanitizeChatMessage(payload);
      assert.ok(!result.includes('<script>'), 'Should not contain script tag');
      assert.ok(!result.includes('alert("XSS")'), 'Should not contain script body');
      assert.ok(result.includes('Hello world'));
      assert.ok(result.includes('how are you?'));
    });

    it('should strip onload, onerror and inline event handlers', () => {
      const payload = 'Image proof: <img src="x" onerror="stealCookies()">';
      const result = sanitizeChatMessage(payload);
      assert.ok(!result.includes('onerror'), 'Should strip onerror');
      assert.ok(!result.includes('stealCookies'), 'Should strip payload function');
    });

    it('should strip javascript: pseudo-protocols', () => {
      const payload = '<a href="javascript:doMalicious()">Click here</a>';
      const result = sanitizeChatMessage(payload);
      assert.ok(!result.includes('javascript:'), 'Should strip javascript: protocol');
      assert.ok(!result.includes('doMalicious()'), 'Should strip payload function');
    });

    it('should escape raw HTML tags into safe entities', () => {
      const payload = '<b>Bold text</b>';
      const result = sanitizeChatMessage(payload);
      assert.equal(result, '&lt;b&gt;Bold text&lt;/b&gt;');
    });

    it('should enforce maximum message length limit', () => {
      const longMessage = 'A'.repeat(15000);
      const result = sanitizeChatMessage(longMessage, 10000);
      assert.equal(result.length, 10000);
    });
  });

  describe('2. Attachment Executable & Size Guard', () => {
    it('should block dangerous executable file extensions', () => {
      const dangerousFiles = [
        'trojan.exe',
        'script.sh',
        'payload.bat',
        'backdoor.php',
        'exploit.vbs',
        'malware.jar'
      ];

      dangerousFiles.forEach((fileName) => {
        const check = validateAttachment({ fileName, fileSize: 1024 });
        assert.equal(check.valid, false, `Should reject ${fileName}`);
        assert.ok(check.error.includes('blocked for security reasons'));
      });
    });

    it('should allow benign business attachments (jpg, png, pdf, xlsx, mp3)', () => {
      const safeFiles = [
        'fabric_sample.jpg',
        'jobcard_proof.png',
        'production_report.pdf',
        'billing_challan.xlsx',
        'voice_note.mp3'
      ];

      safeFiles.forEach((fileName) => {
        const check = validateAttachment({ fileName, fileSize: 5 * 1024 * 1024 });
        assert.equal(check.valid, true, `Should accept ${fileName}`);
      });
    });

    it('should reject attachments exceeding 50MB limit', () => {
      const check = validateAttachment({ fileName: 'huge_archive.zip', fileSize: 60 * 1024 * 1024 });
      assert.equal(check.valid, false);
      assert.ok(check.error.includes('exceeds maximum allowable limit'));
    });
  });

  describe('3. Admin Privilege Enforcement', () => {
    it('should allow admin and super_admin users to proceed', () => {
      const req = { user: { role: 'admin', isMainAdmin: true } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireAdmin(req, res, next);
      assert.equal(nextCalled, true);
    });

    it('should reject non-admin users with 403 Forbidden', () => {
      const req = { user: { role: 'operator', name: 'John Doe' } };
      let statusCode = 0;
      let responseBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(body) {
              responseBody = body;
            }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireAdmin(req, res, next);
      assert.equal(statusCode, 403);
      assert.equal(responseBody.success, false);
      assert.ok(responseBody.message.includes('Forbidden: Admin privileges required'));
      assert.equal(nextCalled, false);
    });
  });

  describe('4. Authentication Guard on Requests', () => {
    it('should reject unauthenticated requests without token or user', async () => {
      const req = { headers: {}, query: {} };
      let statusCode = 0;
      let responseBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(body) {
              responseBody = body;
            }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await requireAuth(req, res, next);
      assert.equal(statusCode, 401);
      assert.equal(responseBody.success, false);
      assert.equal(nextCalled, false);
    });
  });
});
