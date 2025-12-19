import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { csrfProtection } from '../replitAuth';
import { rateLimitMiddleware, RATE_LIMIT_CONFIG } from '../utils/rateLimit';
import { hashWebhookApiKey, verifyWebhookApiKey, generateWebhookApiKey } from '../utils/webhookKeyHash';

describe('Security Integration Tests', () => {
  
  describe('CSRF Protection Middleware', () => {
    let app: Express;
    
    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use(csrfProtection);
      
      app.get('/api/test', (req, res) => res.json({ success: true }));
      app.post('/api/test', (req, res) => res.json({ success: true }));
      app.put('/api/test', (req, res) => res.json({ success: true }));
      app.patch('/api/test', (req, res) => res.json({ success: true }));
      app.delete('/api/test', (req, res) => res.json({ success: true }));
      
      app.post('/api/webhooks/test', (req, res) => res.json({ success: true }));
    });
    
    it('should allow GET requests without Origin/Referer headers', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should block POST requests without Origin/Referer headers', async () => {
      const response = await request(app)
        .post('/api/test')
        .send({ data: 'test' });
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF');
    });
    
    it('should block PUT requests without Origin/Referer headers', async () => {
      const response = await request(app)
        .put('/api/test')
        .send({ data: 'test' });
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF');
    });
    
    it('should block PATCH requests without Origin/Referer headers', async () => {
      const response = await request(app)
        .patch('/api/test')
        .send({ data: 'test' });
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF');
    });
    
    it('should block DELETE requests without Origin/Referer headers', async () => {
      const response = await request(app).delete('/api/test');
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF');
    });
    
    it('should allow POST with valid Origin header matching Host', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Host', 'localhost')
        .set('Origin', 'http://localhost')
        .send({ data: 'test' });
      expect(response.status).toBe(200);
    });
    
    it('should allow POST with valid Referer header matching Host', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Host', 'localhost')
        .set('Referer', 'http://localhost/page')
        .send({ data: 'test' });
      expect(response.status).toBe(200);
    });
    
    it('should block POST with Origin header not matching Host', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Host', 'legitimate-site.com')
        .set('Origin', 'http://evil-site.com')
        .send({ data: 'test' });
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('origin mismatch');
    });
    
    it('should skip CSRF check for webhook endpoints', async () => {
      const response = await request(app)
        .post('/api/webhooks/test')
        .send({ data: 'test' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should handle invalid Origin URL gracefully', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Host', 'localhost')
        .set('Origin', 'not-a-valid-url')
        .send({ data: 'test' });
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('invalid origin');
    });
  });
  
  describe('Webhook API Key Authentication', () => {
    it('should generate unique API keys', () => {
      const key1 = generateWebhookApiKey();
      const key2 = generateWebhookApiKey();
      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThan(20);
    });
    
    it('should produce consistent hashes for same key', () => {
      const key = 'test-api-key-12345';
      const hash1 = hashWebhookApiKey(key);
      const hash2 = hashWebhookApiKey(key);
      expect(hash1).toBe(hash2);
    });
    
    it('should produce different hashes for different keys', () => {
      const hash1 = hashWebhookApiKey('key-one');
      const hash2 = hashWebhookApiKey('key-two');
      expect(hash1).not.toBe(hash2);
    });
    
    it('should verify correct key against hash', () => {
      const key = 'my-secret-api-key';
      const hash = hashWebhookApiKey(key);
      expect(verifyWebhookApiKey(key, hash)).toBe(true);
    });
    
    it('should reject incorrect key against hash', () => {
      const correctKey = 'correct-key';
      const wrongKey = 'wrong-key';
      const hash = hashWebhookApiKey(correctKey);
      expect(verifyWebhookApiKey(wrongKey, hash)).toBe(false);
    });
    
    it('should use timing-safe comparison (no early exit)', () => {
      const key = 'test-key';
      const hash = hashWebhookApiKey(key);
      
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        verifyWebhookApiKey('a' + key.slice(1), hash);
      }
      const firstCharDiff = Date.now() - startTime;
      
      const startTime2 = Date.now();
      for (let i = 0; i < 1000; i++) {
        verifyWebhookApiKey(key.slice(0, -1) + 'z', hash);
      }
      const lastCharDiff = Date.now() - startTime2;
      
      const ratio = Math.abs(firstCharDiff - lastCharDiff) / Math.max(firstCharDiff, lastCharDiff);
      expect(ratio).toBeLessThan(0.5);
    });
    
    it('should handle malformed hash gracefully', () => {
      expect(verifyWebhookApiKey('any-key', 'not-a-valid-hex-hash!!!')).toBe(false);
      expect(verifyWebhookApiKey('any-key', '')).toBe(false);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should have valid rate limit configuration', () => {
      expect(RATE_LIMIT_CONFIG.WEBHOOK_LIMIT).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIG.PDF_PARSE_LIMIT).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIG.AI_LIMIT).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIG.AUTH_LIMIT).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIG.UPLOAD_LIMIT).toBeGreaterThan(0);
    });
    
    it('should have valid window configurations', () => {
      expect(RATE_LIMIT_CONFIG.WEBHOOK_WINDOW_MS).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_CONFIG.PDF_PARSE_WINDOW_MS).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_CONFIG.AI_WINDOW_MS).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_CONFIG.AUTH_WINDOW_MS).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS).toBeGreaterThanOrEqual(1000);
    });
    
    it('should export rate limit middleware function', () => {
      expect(typeof rateLimitMiddleware).toBe('function');
      const middleware = rateLimitMiddleware();
      expect(typeof middleware).toBe('function');
    });
    
    it('should define rate limit rules for key security endpoints', async () => {
      const { RATE_LIMIT_RULES } = await import('../utils/rateLimit');
      
      const webhookRule = RATE_LIMIT_RULES.find(r => r.pattern.test('/api/webhooks/prospects'));
      expect(webhookRule).toBeDefined();
      expect(webhookRule?.keyType).toBe('apiKey');
      
      const pdfRule = RATE_LIMIT_RULES.find(r => r.pattern.test('/api/parse-pdf'));
      expect(pdfRule).toBeDefined();
      expect(pdfRule?.keyType).toBe('user');
      
      const aiRule = RATE_LIMIT_RULES.find(r => r.pattern.test('/api/analyze-csv'));
      expect(aiRule).toBeDefined();
      expect(aiRule?.keyType).toBe('user');
      
      const authRule = RATE_LIMIT_RULES.find(r => r.pattern.test('/api/login'));
      expect(authRule).toBeDefined();
      expect(authRule?.keyType).toBe('ip');
    });
    
    it('should provide rate limit status function', async () => {
      const { getRateLimitStatus } = await import('../utils/rateLimit');
      
      const status = getRateLimitStatus();
      expect(status.backend).toMatch(/redis|memory/);
      expect(status.config).toBeDefined();
      expect(status.config.WEBHOOK_LIMIT).toBeGreaterThan(0);
    });
  });
  
  describe('Upload Limits and MIME Validation', () => {
    const ALLOWED_EXTENSIONS = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
      'png', 'jpg', 'jpeg', 'gif', 'webp',
      'txt', 'rtf', 'odt', 'ods'
    ];
    
    const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
    
    function validateFile(fileName: string, fileSize: number): string | null {
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
        return `File type .${extension} is not allowed`;
      }
      if (fileSize > FILE_SIZE_LIMIT) {
        return `File exceeds size limit`;
      }
      return null;
    }
    
    it('should allow PDF files', () => {
      expect(validateFile('document.pdf', 1000)).toBeNull();
    });
    
    it('should allow common document types', () => {
      expect(validateFile('doc.docx', 1000)).toBeNull();
      expect(validateFile('spreadsheet.xlsx', 1000)).toBeNull();
      expect(validateFile('data.csv', 1000)).toBeNull();
    });
    
    it('should allow image types', () => {
      expect(validateFile('photo.jpg', 1000)).toBeNull();
      expect(validateFile('image.png', 1000)).toBeNull();
      expect(validateFile('animation.gif', 1000)).toBeNull();
      expect(validateFile('modern.webp', 1000)).toBeNull();
    });
    
    it('should reject executable files', () => {
      const error = validateFile('malware.exe', 1000);
      expect(error).toContain('not allowed');
    });
    
    it('should reject script files', () => {
      expect(validateFile('script.js', 1000)).toContain('not allowed');
      expect(validateFile('script.sh', 1000)).toContain('not allowed');
      expect(validateFile('script.php', 1000)).toContain('not allowed');
    });
    
    it('should reject archive files', () => {
      expect(validateFile('archive.zip', 1000)).toContain('not allowed');
      expect(validateFile('archive.tar.gz', 1000)).toContain('not allowed');
    });
    
    it('should reject files without extension', () => {
      expect(validateFile('noextension', 1000)).toContain('not allowed');
    });
    
    it('should reject files exceeding size limit', () => {
      const overLimit = FILE_SIZE_LIMIT + 1;
      expect(validateFile('valid.pdf', overLimit)).toContain('exceeds');
    });
    
    it('should allow files at exactly the size limit', () => {
      expect(validateFile('valid.pdf', FILE_SIZE_LIMIT)).toBeNull();
    });
    
    it('should be case-insensitive for extensions', () => {
      expect(validateFile('document.PDF', 1000)).toBeNull();
      expect(validateFile('image.JPG', 1000)).toBeNull();
      expect(validateFile('file.DOCX', 1000)).toBeNull();
    });
  });
  
  describe('AI Governance Redaction', () => {
    let redactSensitiveData: (text: string) => { 
      redacted: string; 
      redactionApplied: boolean; 
      fieldsRedacted: string[]; 
    };
    
    beforeAll(async () => {
      const aiGovernance = await import('../utils/aiGovernance');
      redactSensitiveData = aiGovernance.redactSensitiveData;
    });
    
    it('should redact IBAN numbers', () => {
      const text = 'Bank account: GB82WEST12345698765432';
      const { redacted, redactionApplied, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('GB82WEST');
      expect(redacted).toContain('[REDACTED_IBAN]');
      expect(redactionApplied).toBe(true);
      expect(fieldsRedacted).toContain('iban');
    });
    
    it('should redact UK sort codes', () => {
      const text = 'Sort code: 12-34-56';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('12-34-56');
      expect(fieldsRedacted).toContain('sort_code');
    });
    
    it('should redact email addresses', () => {
      const text = 'Contact: john.doe@example.com';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('john.doe@example.com');
      expect(redacted).toContain('[REDACTED_EMAIL]');
      expect(fieldsRedacted).toContain('email');
    });
    
    it('should redact UK phone numbers', () => {
      const text = 'Call us at 07911123456';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('07911123456');
      expect(fieldsRedacted).toContain('phone_uk');
    });
    
    it('should redact UK postcodes', () => {
      const text = 'Address: 123 Main St, London SW1A 1AA';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('SW1A 1AA');
      expect(redacted).toContain('[REDACTED_POSTCODE]');
      expect(fieldsRedacted).toContain('postcode_uk');
    });
    
    it('should redact National Insurance numbers', () => {
      const text = 'NI Number: AB 12 34 56 C';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('AB 12 34 56 C');
      expect(redacted).toContain('[REDACTED_NI]');
      expect(fieldsRedacted).toContain('ni_number');
    });
    
    it('should redact credit card numbers', () => {
      const text = 'Card: 4111-1111-1111-1111';
      const { redacted, fieldsRedacted } = redactSensitiveData(text);
      expect(redacted).not.toContain('4111-1111-1111-1111');
      expect(redacted).toContain('[REDACTED_CARD]');
      expect(fieldsRedacted).toContain('credit_card');
    });
    
    it('should preserve non-sensitive text', () => {
      const text = 'Company revenue was £1,500,000 in 2024.';
      const { redacted, redactionApplied } = redactSensitiveData(text);
      expect(redacted).toContain('Company revenue');
      expect(redacted).toContain('£1,500,000');
      expect(redacted).toContain('2024');
      expect(redactionApplied).toBe(false);
    });
    
    it('should track all redacted field types', () => {
      const text = 'Email: a@b.com Sort: 12-34-56 NI: AB 12 34 56 C';
      const { fieldsRedacted } = redactSensitiveData(text);
      expect(fieldsRedacted.length).toBeGreaterThanOrEqual(2);
    });
  });
});
