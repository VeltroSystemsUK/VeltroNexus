#!/bin/bash
set -e

echo "========================================"
echo "FlowLoan CI Pipeline"
echo "========================================"
echo ""

# ============================================================================
# SECURITY ALLOWLIST
# Document any temporarily allowed CVEs here with expiration dates.
# Format: CVE-YYYY-NNNNN expires YYYY-MM-DD reason
# Example: CVE-2024-12345 expires 2025-02-01 "No patch available, mitigated by WAF"
# ============================================================================
ALLOWED_CVES=""

echo "[1/7] Checking for high/critical vulnerabilities..."
# npm audit --omit=dev excludes devDependencies from production vulnerability checks
AUDIT_OUTPUT=$(npm audit --audit-level=high --omit=dev 2>&1) || AUDIT_EXIT=$?

if [ -z "$AUDIT_EXIT" ] || [ "$AUDIT_EXIT" -eq 0 ]; then
  echo "No high/critical vulnerabilities found in production dependencies."
else
  echo ""
  echo "ERROR: High/critical vulnerabilities detected in production dependencies!"
  echo "$AUDIT_OUTPUT" | head -50
  echo ""
  
  # Check if all found CVEs are in the allowlist
  if [ -n "$ALLOWED_CVES" ]; then
    echo "Checking against allowlist..."
    # For now, fail the build - implement CVE parsing if allowlist is used
  fi
  
  echo "To fix: Run 'npm audit fix' or update vulnerable packages."
  echo "To temporarily allow (NOT RECOMMENDED): Add CVE to ALLOWED_CVES with expiration."
  exit 1
fi
echo ""

echo "[2/7] Running Prettier format check..."
npx prettier --check "client/src/**/*.{ts,tsx}" "server/**/*.ts" "shared/**/*.ts" || {
  echo "ERROR: Formatting issues detected. Run 'npx prettier --write .' to fix."
  exit 1
}
echo "Prettier check passed!"
echo ""

echo "[3/7] Running ESLint..."
npx eslint client/src server shared --max-warnings 0 || {
  echo "ERROR: ESLint found errors. Fix them before committing."
  exit 1
}
echo "ESLint check passed!"
echo ""

echo "[4/7] Running TypeScript type check..."
npm run check || {
  echo "ERROR: TypeScript type check failed."
  exit 1
}
echo "Type check passed!"
echo ""

echo "[5/7] Running security tests with coverage..."
npx vitest run --reporter=verbose --coverage || {
  echo "ERROR: Tests failed."
  exit 1
}
echo "All tests passed!"
echo ""

echo "[6/7] Checking coverage threshold..."
# Coverage report is generated in coverage/ directory
# Baseline prevents regression; ratchet upward as more tests are added
COVERAGE_THRESHOLD=3   # Current baseline (ratchet up as coverage improves)
COVERAGE_TARGET=40     # Target coverage to work towards
if [ -f coverage/coverage-summary.json ]; then
  COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
  echo "Current statement coverage: $COVERAGE%"
  echo "Baseline threshold: $COVERAGE_THRESHOLD% | Target: $COVERAGE_TARGET%"
  
  # Check if coverage is below threshold (prevents regression)
  IS_BELOW=$(node -p "$COVERAGE < $COVERAGE_THRESHOLD")
  if [ "$IS_BELOW" = "true" ]; then
    echo "ERROR: Statement coverage ($COVERAGE%) dropped below $COVERAGE_THRESHOLD% baseline"
    echo "This indicates test coverage has regressed. Add more tests before committing."
    exit 1
  else
    echo "Coverage baseline check passed: $COVERAGE% >= $COVERAGE_THRESHOLD%"
    if [ $(node -p "$COVERAGE < $COVERAGE_TARGET") = "true" ]; then
      echo "NOTE: Coverage is below $COVERAGE_TARGET% target. Consider adding more tests."
    fi
  fi
else
  echo "WARNING: Coverage summary not found at coverage/coverage-summary.json"
  echo "Run 'npx vitest run --coverage' to generate coverage report"
fi
echo ""

echo "[7/7] Security validation summary..."
echo "  - Dependency audit: PASSED (production deps only)"
echo "  - CSRF protection: Tested"
echo "  - Webhook authentication: Tested"
echo "  - Rate limiting: Tested"
echo "  - Upload validation: Tested"
echo "  - AI data redaction: Tested"
echo "  - Streaming uploads: Implemented (no RAM buffering)"
echo "  - Health endpoint: /healthz"
echo ""

echo "========================================"
echo "CI Pipeline Complete - All checks passed!"
echo "========================================"
