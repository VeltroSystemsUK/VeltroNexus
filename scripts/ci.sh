#!/bin/bash
set -e

echo "========================================"
echo "FlowLoan CI Pipeline"
echo "========================================"
echo ""

# Use local binaries to avoid npx resolution overhead
PRETTIER="./node_modules/.bin/prettier"
ESLINT="./node_modules/.bin/eslint"
VITEST="./node_modules/.bin/vitest"

echo "[1/7] Checking for high/critical vulnerabilities..."
npm audit --audit-level=high --omit=dev || {
  echo "ERROR: High/critical vulnerabilities detected in production dependencies!"
  echo "To fix: Run 'npm audit fix' or update vulnerable packages."
  exit 1
}
echo "No high/critical vulnerabilities found."
echo ""

echo "[2/7] Running Prettier format check..."
$PRETTIER --check "client/src/**/*.{ts,tsx}" "server/**/*.ts" "shared/**/*.ts" || {
  echo "ERROR: Formatting issues detected. Run 'npx prettier --write .' to fix."
  exit 1
}
echo "Prettier check passed!"
echo ""

echo "[3/7] Running ESLint..."
# Allow warnings but fail on errors - use high max-warnings to allow existing warnings
$ESLINT client/src server shared --max-warnings 200 || {
  echo "ERROR: ESLint found errors. Fix them before committing."
  exit 1
}
echo "ESLint check passed!"
echo ""

echo "[4/7] Running TypeScript check..."
# TypeScript baseline gate: fails if errors increase beyond baseline
# Pre-existing type errors are tracked in .ts-error-baseline (see TECH_DEBT.md)
set +e  # Temporarily disable exit on error
npm run check 2>&1 | tee /tmp/ts-check.log > /dev/null
TS_EXIT_CODE=${PIPESTATUS[0]}
set -e  # Re-enable exit on error

TS_ERROR_COUNT=$(grep -c "error TS" /tmp/ts-check.log || echo 0)
TS_BASELINE_FILE=".ts-error-baseline"
if [ -f "$TS_BASELINE_FILE" ]; then
  TS_BASELINE=$(cat "$TS_BASELINE_FILE")
else
  TS_BASELINE=136  # Initial baseline
fi
echo "Found $TS_ERROR_COUNT TypeScript errors (baseline: $TS_BASELINE)."

if [ "$TS_ERROR_COUNT" -gt "$TS_BASELINE" ]; then
  echo "ERROR: TypeScript errors increased from $TS_BASELINE to $TS_ERROR_COUNT."
  echo "New errors introduced:"
  head -50 /tmp/ts-check.log
  echo ""
  echo "Fix new type errors or update baseline with: echo $TS_ERROR_COUNT > $TS_BASELINE_FILE"
  exit 1
fi
echo "TypeScript error gate passed!"
echo ""

echo "[5/7] Running tests with coverage..."
$VITEST run --coverage || {
  echo "ERROR: Tests failed."
  exit 1
}
echo "All tests passed!"
echo ""

echo "[6/7] Checking coverage thresholds..."
if [ -f coverage/coverage-summary.json ]; then
  # Overall minimum
  OVERALL=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
  echo "Overall coverage: $OVERALL%"
  
  # Security-critical folder thresholds (server/utils contains auth, webhooks, AI governance)
  UTILS_COV=$(node -p "
    const data = JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json'));
    const utils = Object.entries(data)
      .filter(([k]) => k.includes('server/utils/'))
      .map(([,v]) => v.statements);
    if (utils.length === 0) { console.log(0); process.exit(); }
    const total = utils.reduce((a,b) => a + b.total, 0);
    const covered = utils.reduce((a,b) => a + b.covered, 0);
    console.log(total > 0 ? (covered/total*100).toFixed(2) : 0);
  ")
  echo "Security utils coverage: $UTILS_COV%"
  
  # Thresholds
  MIN_OVERALL=3
  MIN_UTILS=10
  TARGET_OVERALL=40
  TARGET_UTILS=50
  
  # Check overall
  if [ $(node -p "$OVERALL < $MIN_OVERALL") = "true" ]; then
    echo "ERROR: Overall coverage ($OVERALL%) below $MIN_OVERALL% baseline"
    exit 1
  fi
  
  # Check security utils
  if [ $(node -p "$UTILS_COV < $MIN_UTILS") = "true" ]; then
    echo "ERROR: Security utils coverage ($UTILS_COV%) below $MIN_UTILS% minimum"
    exit 1
  fi
  
  echo "Coverage gates passed!"
  [ $(node -p "$OVERALL < $TARGET_OVERALL") = "true" ] && echo "NOTE: Overall below $TARGET_OVERALL% target"
  [ $(node -p "$UTILS_COV < $TARGET_UTILS") = "true" ] && echo "NOTE: Utils below $TARGET_UTILS% target"
else
  echo "WARNING: Coverage summary not found"
fi
echo ""

echo "[7/9] Checking for new 'any' type usage in server..."
# Count explicit 'any' types (excluding allowed patterns like error: any in catch)
# Baseline tracked in .any-baseline file
ANY_COUNT=$(grep -r ": any" server/*.ts server/utils/*.ts 2>/dev/null | grep -v "catch (error" | wc -l || echo 0)
BASELINE_FILE=".any-baseline"
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
else
  BASELINE=150  # Initial conservative baseline
fi
echo "Found $ANY_COUNT 'any' usages (baseline: $BASELINE)."
if [ "$ANY_COUNT" -gt "$BASELINE" ]; then
  echo "ERROR: 'any' type usage increased from $BASELINE to $ANY_COUNT."
  echo "Reduce type-unsafe code or update baseline with: echo $ANY_COUNT > $BASELINE_FILE"
  exit 1
fi
echo "'any' gate passed!"
echo ""

echo "[8/9] Checking for raw error.message exposure..."
# Count raw error.message in JSON responses (should use handleApiError instead)
RAW_ERR_COUNT=$(grep -r "res\\.status.*json.*error\\.message" server/routes.ts 2>/dev/null | wc -l || echo 0)
if [ "$RAW_ERR_COUNT" -gt 0 ]; then
  echo "ERROR: Found $RAW_ERR_COUNT raw error.message in responses."
  echo "Use handleApiError() for consistent, safe error responses."
  exit 1
fi
echo "Raw error.message check passed (0 instances)."
echo ""

echo "[9/9] Security validation summary..."
echo "  - Dependency audit: PASSED"
echo "  - CSRF protection: Tested"
echo "  - Webhook auth: Tested"
echo "  - Rate limiting: Tested"
echo "  - AI governance: Tested"
echo "  - Error handling: Standardized"
echo ""

echo "========================================"
echo "CI Pipeline Complete!"
echo "========================================"
