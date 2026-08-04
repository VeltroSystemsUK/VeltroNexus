# Release & Deployment Guide

This document outlines the release process, deployment checklist, and rollback procedures.

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing: `npx vitest run`
- [ ] TypeScript compiles: `npm run check`
- [ ] ESLint passes: `npx eslint client/src server shared`
- [ ] Prettier formatted: `npx prettier --check .`
- [ ] No high/critical vulnerabilities: `npm audit --audit-level=high`

### Full CI Pipeline
Run the complete CI pipeline:
```bash
./scripts/ci.sh
```

This executes:
1. npm audit (high/critical check)
2. Prettier format check
3. ESLint
4. TypeScript type check
5. Security tests (41 tests)
6. Validation summary

### Database
- [ ] Schema changes reviewed
- [ ] Migrations tested on staging
- [ ] Backup verified before destructive changes
- [ ] No breaking changes to existing data

### Environment
- [ ] All required env vars documented
- [ ] Production secrets rotated if needed
- [ ] Redis accessible from production
- [ ] Object storage bucket accessible

## Release Process

### 1. Version Bump
Update version in relevant files:
```bash
# Update package.json version
npm version patch|minor|major
```

### 2. Create Release Branch
```bash
git checkout -b release/v1.2.3
git push origin release/v1.2.3
```

### 3. Run Full Test Suite
```bash
./scripts/ci.sh
```

### 4. Deploy to Staging
- Deploy release branch to staging environment
- Run smoke tests
- Verify health check: `curl https://staging.example.com/healthz`

### 5. Production Deployment
- Merge release branch to main
- Deploy locally: `npm run build && npm start` on the machine this runs on
- Monitor deployment logs

### 6. Post-Deployment Verification
```bash
# Health check
curl https://production.example.com/healthz

# Verify critical paths
# - Login works
# - Can create prospect
# - Can upload document
# - Rate limiting active
```

## Rollback Procedures

### Quick Rollback (git)
1. `git log` to find the last known-good commit
2. `git revert` (or reset, if the bad commit isn't shared/pushed) to that commit
3. Rebuild and restart: `npm run build && npm start`

### Database Rollback
For schema changes that need reverting:
1. Identify the previous schema state
2. Create reverse migration
3. Apply with caution

**Warning:** Data migrations may not be reversible. Always backup before destructive changes.

### Feature Flag Rollback
If feature flags are implemented:
1. Disable problematic feature via flag
2. No code deployment needed
3. Investigate and fix
4. Re-enable when ready

## Deployment Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local development | `localhost:5000` |
| Staging | Pre-production testing | N/A — local-only app |
| Production | Live user traffic | `localhost:5000` on the machine this runs on |

## Monitoring Post-Deploy

### Health Check
```bash
curl -s http://localhost:5000/healthz | jq
```

Expected output:
```json
{
  "status": "healthy",
  "components": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "objectStorage": { "status": "healthy" }
  }
}
```

### Log Monitoring
Watch for:
- Error rate spikes
- Rate limit violations
- Authentication failures
- Slow response times

### Key Metrics
- Response time p50, p95, p99
- Error rate (4xx, 5xx)
- Rate limit hit rate
- Database connection pool usage

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Service down, data loss | Immediate |
| P2 | Major feature broken | 1 hour |
| P3 | Minor feature issue | 4 hours |
| P4 | Cosmetic/low impact | Next sprint |

### Rollback Decision Tree
```
Is production broken?
├── Yes: Immediate rollback
│   └── Then investigate
└── No: Is it affecting users?
    ├── Yes: Rollback if >15min to fix
    └── No: Fix forward
```

## Security Release

For security-related releases:
1. Do not disclose vulnerability details in commit messages
2. Use generic commit message: "Security improvements"
3. Notify security team
4. Consider coordinated disclosure if external

## Release Notes Template

```markdown
## v1.2.3 - YYYY-MM-DD

### Added
- New feature description

### Changed
- Modification description

### Fixed
- Bug fix description

### Security
- Security improvement (generic description)

### Breaking Changes
- Any breaking changes requiring user action
```
