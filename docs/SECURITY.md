# Security Guardrails and Invariants

This document outlines the security controls, invariants, and requirements for FlowLoan.

## Authentication & Authorization

### Session Security
- Sessions use `express-session` with PostgreSQL-backed storage (`connect-pg-simple`)
- Session cookies configured with:
  - `httpOnly: true` - Prevents JavaScript access
  - `sameSite: 'lax'` - Prevents CSRF via cross-site form submission
  - `secure: true` (production) - Cookies only sent over HTTPS

### Role-Based Access Control (RBAC)
Four roles with escalating permissions:
1. **Broker User** - Can manage own prospects and submit for underwriting
2. **Underwriter** - Can claim and review underwriting submissions
3. **Sales Admin** - Can manage team members and view team data
4. **Super Admin** - Full system access including add-on management

### Route Protection
- All `/api/*` routes (except auth endpoints) require authenticated session
- Role-specific routes enforce role checks via middleware
- User data isolation: users can only access their own prospects/companies

## CSRF Protection

### Origin/Referer Validation
State-changing requests (POST, PUT, PATCH, DELETE) must include valid Origin or Referer header matching the Host.

**Why strict Origin/Referer**: Prevents cross-site request forgery attacks where malicious sites submit forms to our API using the user's authenticated session.

```typescript
// Requests blocked if:
// 1. No Origin AND no Referer header present
// 2. Origin/Referer hostname doesn't match Host header
```

### Exempt Endpoints
- Webhook endpoints (`/api/webhooks/*`) - Use API key authentication instead
- GET/HEAD/OPTIONS requests - No state changes

## Rate Limiting

### Configuration (Redis-backed)
| Endpoint Type | Limit | Window | Key |
|--------------|-------|--------|-----|
| Webhooks | 60 req/min | 60s | API key hash |
| PDF parsing | 30 req/min | 60s | User ID |
| AI endpoints | 20 req/min | 60s | User ID |
| Auth endpoints | 10 req/min | 60s | IP address |
| Uploads | 30 req/min | 60s | User ID |

### Production Requirement
Redis is **required** in production. The application will fail to start without `REDIS_URL` configured.

**Why Redis required**: In-memory rate limiting doesn't work across multiple instances and can be bypassed by restarting the service.

## File Upload Security

### Parser-Level Limits
Limits enforced at the multipart parser level (busboy) before files reach application code:

**Why parser-level**: Prevents memory exhaustion attacks by rejecting oversized files before buffering.

| Limit | Value |
|-------|-------|
| Max file size | 10MB (branding: 5MB) |
| Max files per request | 10 |
| Allowed extensions | .pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png, .gif |
| Allowed MIME types | Validated against extension |

### Streaming Uploads
All file uploads use streaming via `PassThrough` to object storage.

**Why streaming**: Avoids buffering entire files in RAM, preventing memory exhaustion.

### Object Storage Access Control
- Public access only for allowlisted prefixes: `branding/`
- All other files require authenticated API access
- Files stored with path: `private/{userId}/{prospectId}/{filename}`

## Webhook Authentication

### API Key Security
- Keys are never stored in plaintext
- Keys are hashed using HMAC-SHA256 before storage
- Key comparison uses timing-safe comparison to prevent timing attacks

**Why HMAC hash**: If database is compromised, attackers cannot recover API keys.

```typescript
// Key storage: HMAC-SHA256(apiKey, WEBHOOK_KEY_SECRET)
// Comparison: timingSafeEqual(storedHash, computedHash)
```

### Idempotency
- Webhook requests should include `X-Idempotency-Key` header
- Duplicate requests with same idempotency key are safely ignored

## AI Governance

### Consent Requirements
Two-tier consent model:
1. **User-level consent** - Stored in user settings (`aiDataConsent` field)
2. **Per-request consent** - Required in API payload (`consentToAiProcessing: true`)

Both must be true for AI processing to proceed.

**Why two-tier**: User can revoke consent at any time; per-request ensures explicit acknowledgment.

### Data Redaction
PII is automatically redacted before AI processing:
- UK postcodes (full and partial)
- Email addresses
- Phone numbers (UK and international)
- National Insurance numbers
- Bank account numbers / IBANs / Sort codes
- Credit card numbers

**Why redaction**: Minimizes sensitive data exposure to AI models.

### Audit Logging
All AI operations are logged with:
```json
{
  "type": "ai_operation",
  "operation": "credit_underwriting",
  "userId": "...",
  "prospectId": "...",
  "dataSizeBytes": 1234,
  "timestamp": "..."
}
```

## Content Security Policy

CSP headers applied to HTML responses:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://api.resend.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

**Why strict CSP**: Prevents XSS attacks by blocking inline scripts and unauthorized sources.

## Logging & Observability

### What Is Logged
- Request metadata: method, path, status, duration, request ID
- Error types and stack traces (development only)
- Rate limit violations
- AI operation metadata

### What Is NOT Logged
- Request/response bodies
- Email addresses, phone numbers, PII
- API keys or secrets
- Session tokens

**Why no body logging**: Bodies may contain sensitive customer data; logging them creates compliance and security risks.

## Request Size Limits

| Route | Limit |
|-------|-------|
| Global default | 5MB |
| AI endpoints | 2MB |
| PDF parsing | 10MB |
| File uploads | 10MB per file |

## Security Testing

The project includes 41 automated security tests covering:
- CSRF protection (11 tests)
- Webhook authentication (7 tests)
- Rate limiting (5 tests)
- Upload validation (10 tests)
- AI data redaction (9 tests)

Run security tests:
```bash
npx vitest run
```
