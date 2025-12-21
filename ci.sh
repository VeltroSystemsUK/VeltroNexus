#!/bin/bash

# CI/CD Pipeline Script for FlowLoan
# This script runs all quality checks before deployment

set -e  # Exit on error

echo "======================================================================"
echo "  FlowLoan CI/CD Pipeline"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall success
OVERALL_SUCCESS=true

# Function to print step header
print_step() {
    echo ""
    echo "======================================================================"
    echo "  $1"
    echo "======================================================================"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}✗ $1 failed${NC}"
    OVERALL_SUCCESS=false
    if [ "$CI" = "true" ]; then
        exit 1  # Exit immediately in CI
    fi
}

# Function to handle success
handle_success() {
    echo -e "${GREEN}✓ $1 passed${NC}"
}

# 1. Install dependencies (if needed)
print_step "Step 1: Checking Dependencies"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci || handle_error "Dependency installation"
else
    echo "Dependencies already installed"
    handle_success "Dependencies check"
fi

# 2. Format check
print_step "Step 2: Code Formatting Check"
if npm run format:check; then
    handle_success "Formatting"
else
    handle_error "Formatting"
    echo -e "${YELLOW}Fix with: npm run format${NC}"
fi

# 3. Linting
print_step "Step 3: ESLint Check"
if npm run lint; then
    handle_success "Linting"
else
    handle_error "Linting"
    echo -e "${YELLOW}Fix with: npm run lint:fix${NC}"
fi

# 4. Type checking
print_step "Step 4: TypeScript Type Check"
if npm run check; then
    handle_success "Type checking"
else
    handle_error "Type checking"
fi

# 5. Unit tests
print_step "Step 5: Running Tests"
if npm run test; then
    handle_success "Tests"
else
    handle_error "Tests"
fi

# 6. Test coverage
print_step "Step 6: Test Coverage Check"
if npm run test:coverage; then
    handle_success "Test coverage"
    
    # Check coverage thresholds (if coverage summary exists)
    if [ -f "coverage/coverage-summary.json" ]; then
        echo ""
        echo "Coverage Summary:"
        cat coverage/coverage-summary.json | grep -A 10 "total"
    fi
else
    handle_error "Test coverage"
fi

# 7. Security audit
print_step "Step 7: Security Audit"
if npm run audit:security; then
    handle_success "Security audit"
else
    echo -e "${YELLOW}⚠ Security vulnerabilities found${NC}"
    echo -e "${YELLOW}Review with: npm audit${NC}"
    echo -e "${YELLOW}Fix with: npm run audit:fix${NC}"
    # Don't fail CI on moderate vulnerabilities, just warn
    if [ "$CI" = "true" ]; then
        # Check for high/critical only in CI
        if npm audit --audit-level=high; then
            echo -e "${GREEN}No high/critical vulnerabilities${NC}"
        else
            handle_error "Security audit (high/critical vulnerabilities found)"
        fi
    fi
fi

# 8. Build test (don't actually build in CI, just validate it would work)
if [ "$SKIP_BUILD" != "true" ]; then
    print_step "Step 8: Build Validation"
    if npm run build; then
        handle_success "Build"
        
        # Clean up build artifacts after validation
        if [ "$CI" = "true" ]; then
            echo "Cleaning up build artifacts..."
            rm -rf dist/
        fi
    else
        handle_error "Build"
    fi
fi

# Final summary
echo ""
echo "======================================================================"
echo "  Pipeline Summary"
echo "======================================================================"

if [ "$OVERALL_SUCCESS" = true ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Ready for deployment 🚀"
    exit 0
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Please fix the issues above before deploying"
    exit 1
fi
