# Operations Runbook

This document provides incident response procedures for common operational issues.

## Health Check

### Endpoint
```bash
GET /healthz
```

Returns JSON with status of all critical dependencies:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "components": {
    "database": { "status": "healthy", "latencyMs": 5 },
    "redis": { "status": "healthy", "latencyMs": 2 },
    "objectStorage": { "status": "healthy", "latencyMs": 15 }
  }
}
```

HTTP 200 = healthy, HTTP 503 = degraded

## Incident: Redis Down

### Symptoms
- Rate limiting not working (requests not being limited)
- Health check shows `redis: unhealthy`
- Log entries: `{"type":"rate_limit_redis","status":"disconnected"}`

### Impact
- **Development**: Falls back to in-memory rate limiting (limited protection)
- **Production**: Application will not start / crash on Redis disconnect

### Resolution
1. Check Redis connection string in `REDIS_URL`
2. Verify Redis server is running and accessible
3. Check network connectivity between app and Redis
4. Restart application after Redis is restored

### Prevention
- Configure Redis connection pooling with retry logic
- Set up Redis health monitoring/alerts
- Consider Redis Sentinel or Cluster for HA

## Incident: Object Storage Errors

### Symptoms
- File uploads failing with 500 errors
- Document downloads returning errors
- Health check shows `objectStorage: unhealthy`
- Log entries containing storage errors

### Impact
- Users cannot upload documents
- Existing documents may be inaccessible
- Branding logos not loading

### Resolution
1. Check `DEFAULT_OBJECT_STORAGE_BUCKET_ID` is set
2. Verify bucket exists and is accessible
3. Check storage quota/limits
4. Review object storage service status

### Temporary Mitigation
- Disable file upload features via feature flag (if implemented)
- Communicate to users about temporary upload issues

## Incident: Webhook Failures

### Symptoms
- External systems not receiving prospect data
- Webhook logs showing 4xx/5xx responses
- Rate limit violations in logs

### Diagnosis
1. Check webhook API key is valid:
   ```sql
   SELECT id, created_at FROM webhook_api_keys WHERE user_id = ?;
   ```
2. Review rate limit status (60 req/min per API key)
3. Check request payload format

### Common Causes
| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid/missing API key | Regenerate API key |
| 403 Forbidden | CSRF check (should be bypassed) | Check endpoint path |
| 429 Too Many Requests | Rate limited | Reduce request frequency |
| 400 Bad Request | Invalid payload | Check required fields |

### Resolution
1. Verify `X-FlowLoan-Api-Key` header is present
2. Confirm API key matches stored hash
3. Review payload against schema
4. Check prospect limits for user

## Incident: High Memory Usage

### Symptoms
- Application responding slowly
- Out of memory errors
- Container restarts

### Diagnosis
1. Check for large file uploads in progress
2. Review request patterns for abuse
3. Check for memory leaks in logs

### Common Causes
- Attempted upload of oversized files
- Memory leaks in long-running processes
- Unbounded query results

### Resolution
1. Parser-level limits should reject oversized files automatically
2. Review and kill any stuck requests
3. Restart application if memory doesn't recover
4. Review upload patterns for abuse

### Prevention
- Streaming uploads prevent RAM buffering
- Request size limits enforced at parser level
- Rate limiting prevents abuse

## Incident: Database Connection Issues

### Symptoms
- API requests timing out
- Health check shows `database: unhealthy`
- Connection pool exhausted errors

### Diagnosis
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db';
```

### Resolution
1. Check `DATABASE_URL` configuration
2. Verify database server is running
3. Check connection pool settings
4. Review for long-running queries

### Temporary Mitigation
- Restart application to reset connection pool
- Reduce concurrent request load if possible

## Incident: Authentication Failures

### Symptoms
- Users unable to log in
- Session errors in logs
- OIDC/OAuth errors

### Diagnosis
1. Check OIDC issuer URL is accessible
2. Verify session store (PostgreSQL) is healthy
3. Review session cookie settings

### Resolution
1. Verify `SESSION_SECRET` is set
2. Check `REPLIT_DOMAINS` for correct domain
3. Ensure session table exists in database
4. Clear corrupted sessions if needed

## Log Analysis

### Finding Errors
```bash
# All errors in last hour
grep '"type":"error"' /var/log/app.log | tail -100

# Rate limit violations
grep '"type":"rate_limit_exceeded"' /var/log/app.log

# Failed requests
grep '"status":4' /var/log/app.log
grep '"status":5' /var/log/app.log
```

### Request Tracing
Each request includes `X-Request-Id` header. Use this to trace a request through logs:
```bash
grep 'abc-123-def' /var/log/app.log
```

## Escalation

### When to Escalate
- Data breach suspected
- Prolonged outage (>15 minutes)
- Security vulnerability discovered
- Database corruption

### Contacts
- On-call engineer: [configure in team settings]
- Security team: [configure in team settings]
