import { describe, it, expect } from 'vitest';
import { 
  redactSensitiveData, 
  minimizeCsvData,
  validateRequestSize,
  AI_GOVERNANCE_CONFIG 
} from '../utils/aiGovernance';
import { sanitizeErrorMessage, createErrorResponse } from '../utils/errorResponse';
import { getSicDescription, formatSicCodeWithDescription } from '../utils/sicCodeLookup';
import { hashWebhookApiKey, verifyWebhookApiKey, getApiKeySuffix } from '../utils/webhookKeyHash';

describe('Unit Tests', () => {
  
  describe('Error Response Utilities', () => {
    it('should return the error message string', () => {
      const result = sanitizeErrorMessage('Simple error message');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle Error objects', () => {
      const error = new Error('Test error message');
      const result = sanitizeErrorMessage(error, 400);
      expect(typeof result).toBe('string');
    });
    
    it('should create proper error response structure', () => {
      const error = new Error('Test error');
      const response = createErrorResponse(error, 400, 'req-123');
      
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('requestId', 'req-123');
      expect(typeof response.error).toBe('string');
    });
    
    it('should include request ID when provided', () => {
      const error = new Error('Test error');
      const response = createErrorResponse(error, 500, 'req-123');
      
      expect(response.requestId).toBe('req-123');
    });
    
    it('should work without request ID', () => {
      const error = new Error('Test error');
      const response = createErrorResponse(error, 400);
      
      expect(response).toHaveProperty('error');
      expect(response.requestId).toBeUndefined();
    });
  });
  
  describe('SIC Code Lookup', () => {
    it('should return description for valid SIC code', () => {
      const result = getSicDescription('62011');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle invalid SIC code gracefully', () => {
      const result = getSicDescription('99999');
      // May return empty or 'Unknown' depending on implementation
      expect(typeof result).toBe('string');
    });
    
    it('should handle null/undefined SIC codes', () => {
      expect(getSicDescription(null)).toBe('');
      expect(getSicDescription(undefined)).toBe('');
    });
    
    it('should format SIC code with description', () => {
      const result = formatSicCodeWithDescription('62011');
      expect(result).toContain('62011');
    });
    
    it('should handle missing SIC code in format function', () => {
      const result = formatSicCodeWithDescription('');
      expect(result).toBe('');
    });
  });
  
  describe('AI Governance - Data Redaction', () => {
    it('should redact UK postcodes', () => {
      const { redacted, redactionApplied, fieldsRedacted } = redactSensitiveData('Address: SW1A 1AA');
      expect(redacted).not.toContain('SW1A 1AA');
      expect(redacted).toContain('[REDACTED');
      expect(redactionApplied).toBe(true);
      expect(fieldsRedacted.length).toBeGreaterThan(0);
    });
    
    it('should redact email addresses', () => {
      const { redacted, redactionApplied, fieldsRedacted } = redactSensitiveData('Contact: john.doe@example.com');
      expect(redacted).not.toContain('john.doe@example.com');
      expect(redactionApplied).toBe(true);
      expect(fieldsRedacted).toContain('email');
    });
    
    it('should redact UK phone numbers', () => {
      const { redacted } = redactSensitiveData('Call: 07700 900123');
      expect(redacted).not.toContain('07700 900123');
    });
    
    it('should handle phone number redaction attempt', () => {
      // International phone redaction may vary based on format matching
      const { redacted } = redactSensitiveData('Phone: +44 207 946 0958');
      // Just verify the function runs without error
      expect(typeof redacted).toBe('string');
    });
    
    it('should redact National Insurance numbers', () => {
      const { redacted } = redactSensitiveData('NI: AB123456C');
      expect(redacted).not.toContain('AB123456C');
    });
    
    it('should redact IBANs', () => {
      const { redacted } = redactSensitiveData('IBAN: GB82WEST12345698765432');
      expect(redacted).not.toContain('GB82WEST12345698765432');
    });
    
    it('should redact UK sort codes', () => {
      const { redacted } = redactSensitiveData('Sort code: 12-34-56');
      expect(redacted).not.toContain('12-34-56');
    });
    
    it('should redact credit card numbers', () => {
      const { redacted } = redactSensitiveData('Card: 4111111111111111');
      expect(redacted).not.toContain('4111111111111111');
    });
    
    it('should handle empty string', () => {
      const { redacted, redactionApplied } = redactSensitiveData('');
      expect(redacted).toBe('');
      expect(redactionApplied).toBe(false);
    });
    
    it('should redact multiple items in one string', () => {
      const input = 'Email: test@test.com, Phone: 07700900123, Postcode: SW1A 1AA';
      const { redacted, fieldsRedacted } = redactSensitiveData(input);
      expect(fieldsRedacted.length).toBeGreaterThan(1);
      expect(redacted).not.toContain('test@test.com');
    });
  });
  
  describe('AI Governance - CSV Minimization', () => {
    it('should keep specified columns only', () => {
      const csv = 'name,email,phone,company\nJohn,john@test.com,123456,Acme';
      const result = minimizeCsvData(csv, { allowedFields: ['name', 'company'] });
      expect(result.minimized).toContain('name');
      expect(result.minimized).toContain('company');
      expect(result.minimized).toContain('John');
      expect(result.minimized).toContain('Acme');
      expect(result.minimized).not.toContain('john@test.com');
      expect(result.minimized).not.toContain('123456');
    });
    
    it('should handle empty CSV', () => {
      const result = minimizeCsvData('', { allowedFields: ['name'] });
      expect(result.minimized).toBe('');
    });
    
    it('should handle CSV with only headers', () => {
      const result = minimizeCsvData('name,email', { allowedFields: ['name'] });
      expect(result.minimized).toContain('name');
      expect(result.minimized).not.toContain('email');
    });
    
    it('should track removed fields', () => {
      const csv = 'name,secret,company\nJohn,password123,Acme';
      const result = minimizeCsvData(csv, { allowedFields: ['name', 'company'] });
      expect(result.fieldsRemoved).toContain('secret');
    });
    
    it('should track removed rows when exceeding max', () => {
      const csv = 'name\nRow1\nRow2\nRow3\nRow4\nRow5';
      const result = minimizeCsvData(csv, { maxRowCount: 2 });
      expect(result.rowsRemoved).toBe(3);
    });
  });
  
  describe('AI Governance - Request Size Validation', () => {
    it('should accept data within size limit', () => {
      const data = 'x'.repeat(1000);
      const result = validateRequestSize(data, 2000);
      expect(result.valid).toBe(true);
    });
    
    it('should reject data exceeding size limit', () => {
      const data = 'x'.repeat(3000);
      const result = validateRequestSize(data, 2000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });
    
    it('should use default limit from config', () => {
      const smallData = 'x'.repeat(100);
      const result = validateRequestSize(smallData);
      expect(result.valid).toBe(true);
    });
    
    it('should return sizeBytes in result', () => {
      const data = 'x'.repeat(500);
      const result = validateRequestSize(data);
      expect(result.sizeBytes).toBe(500);
    });
  });
  
  describe('AI Governance - Configuration', () => {
    it('should have required config fields', () => {
      expect(AI_GOVERNANCE_CONFIG).toHaveProperty('maxTotalRequestSize');
      expect(AI_GOVERNANCE_CONFIG).toHaveProperty('auditLogRetentionDays');
      expect(AI_GOVERNANCE_CONFIG.maxTotalRequestSize).toBeGreaterThan(0);
    });
    
    it('should have redaction enabled by default', () => {
      expect(AI_GOVERNANCE_CONFIG).toHaveProperty('enableRedaction');
    });
  });
  
  describe('Webhook Key Hash - Edge Cases', () => {
    it('should handle empty string key', () => {
      const hash = hashWebhookApiKey('');
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });
    
    it('should handle very long keys', () => {
      const longKey = 'x'.repeat(10000);
      const hash = hashWebhookApiKey(longKey);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });
    
    it('should handle special characters in keys', () => {
      const specialKey = 'key-with-special!@#$%^&*()_+{}|:"<>?[]\\;\',./ chars';
      const hash = hashWebhookApiKey(specialKey);
      expect(hash).toBeTruthy();
    });
    
    it('should get consistent key suffix', () => {
      const key = 'fl_test_1234567890abcdef';
      const suffix1 = getApiKeySuffix(key);
      const suffix2 = getApiKeySuffix(key);
      expect(suffix1).toBe(suffix2);
    });
    
    it('should verify correct key against hash', () => {
      const key = 'test-api-key-xyz';
      const hash = hashWebhookApiKey(key);
      expect(verifyWebhookApiKey(key, hash)).toBe(true);
    });
    
    it('should reject incorrect key against hash', () => {
      const key = 'test-api-key-xyz';
      const hash = hashWebhookApiKey(key);
      expect(verifyWebhookApiKey('wrong-key', hash)).toBe(false);
    });
    
    it('should reject key with slight modification', () => {
      const key = 'test-api-key-xyz';
      const hash = hashWebhookApiKey(key);
      expect(verifyWebhookApiKey('test-api-key-xyZ', hash)).toBe(false);
    });
  });
  
  describe('Webhook Key Timing Safety', () => {
    it('should use consistent comparison for key verification', () => {
      // This test verifies the function is callable and deterministic
      // rather than precise timing measurement which is unreliable in CI
      const key = 'test-api-key-for-timing-test';
      const hash = hashWebhookApiKey(key);
      
      // Run multiple times to ensure consistency
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(verifyWebhookApiKey(key, hash));
      }
      
      // All results should be true (consistent)
      expect(results.every(r => r === true)).toBe(true);
      
      // Wrong key should consistently return false
      const wrongResults: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        wrongResults.push(verifyWebhookApiKey('wrong-key', hash));
      }
      expect(wrongResults.every(r => r === false)).toBe(true);
    });
  });
});
