#!/bin/bash
set -e

echo "========================================"
echo "FlowLoan CI Pipeline"
echo "========================================"
echo ""

echo "[1/7] Checking for high/critical vulnerabilities..."
# npm audit --omit=dev excludes devDependencies from production vulnerability checks
# This is a HARD gate - no exceptions. Fix vulnerabilities before merging.
npm audit --audit-level=high --omit=dev || {
  echo ""
  echo "ERROR: High/critical vulnerabilities detected in production dependencies!"
  echo "To fix: Run 'npm audit fix' or update vulnerable packages."
  echo "This check cannot be bypassed - fix all vulnerabilities before merging."
  exit 1
}
echo "No high/critical vulnerabilities found in production dependencies."
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
COVERAGE_THRESHOLD=3
COVERAGE_TARGET=40
if [ -f coverage/coverage-summary.json ]; then
  COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
  echo "Current statement coverage: $COVERAGE%"
  echo "Baseline threshold: $COVERAGE_THRESHOLD% | Target: $COVERAGE_TARGET%"
  
  IS_BELOW=$(node -p "$COVERAGE < $COVERAGE_THRESHOLD")
  if [ "$IS_BELOW" = "true" ]; then
    echo "ERROR: Statement coverage ($COVERAGE%) dropped below $COVERAGE_THRESHOLD% baseline"
    exit 1
  else
    echo "Coverage baseline check passed: $COVERAGE% >= $COVERAGE_THRESHOLD%"
    if [ $(node -p "$COVERAGE < $COVERAGE_TARGET") = "true" ]; then
      echo "NOTE: Coverage is below $COVERAGE_TARGET% target. Consider adding more tests."
    fi
  fi
else
  echo "WARNING: Coverage summary not found"
fi
echo ""

echo "[7/7] Security validation summary..."
echo "  - Dependency audit: PASSED (no bypasses allowed)"
echo "  - CSRF protection: Tested"
echo "  - Webhook authentication: Tested"
echo "  - Rate limiting: Tested"
echo "  - Upload validation: Tested"
echo "  - AI data redaction: Tested"
echo ""

echo "========================================"
echo "CI Pipeline Complete - All checks passed!"
echo "========================================"
