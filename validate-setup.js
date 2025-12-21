#!/usr/bin/env node

/**
 * FlowLoan Setup Validation Script
 * 
 * This script validates your environment setup before running the application.
 * Run with: node scripts/validate-setup.js
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const issues = {
  critical: [],
  warnings: [],
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile() {
  log('\n📋 Checking environment configuration...', 'blue');
  
  const envPath = join(__dirname, '..', '.env');
  
  if (!existsSync(envPath)) {
    issues.critical.push('.env file not found');
    log('  ✗ .env file not found', 'red');
    log('    Copy .env.example to .env and configure your secrets', 'yellow');
    return;
  }
  
  log('  ✓ .env file exists', 'green');
  
  // Parse .env file
  const envContent = readFileSync(envPath, 'utf-8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  // Required variables
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'COMPANIES_HOUSE_API_KEY',
    'GOCARDLESS_ACCESS_TOKEN',
    'GOCARDLESS_ENVIRONMENT',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ];
  
  // Production-only required
  if (process.env.NODE_ENV === 'production') {
    required.push('WEBHOOK_KEY_SECRET', 'REDIS_URL');
  }
  
  // Check required variables
  required.forEach(key => {
    if (!envVars[key] || envVars[key].includes('your_') || envVars[key].includes('change_me')) {
      issues.critical.push(`${key} not properly configured`);
      log(`  ✗ ${key} not set or using default value`, 'red');
    } else {
      log(`  ✓ ${key} is configured`, 'green');
    }
  });
  
  // Validate specific formats
  if (envVars.DATABASE_URL && !envVars.DATABASE_URL.startsWith('postgres')) {
    issues.critical.push('DATABASE_URL must be a PostgreSQL connection string');
    log('  ✗ DATABASE_URL must start with postgres:// or postgresql://', 'red');
  }
  
  if (envVars.SESSION_SECRET && envVars.SESSION_SECRET.length < 32) {
    issues.critical.push('SESSION_SECRET too short (minimum 32 characters)');
    log('  ✗ SESSION_SECRET must be at least 32 characters', 'red');
  }
  
  if (envVars.WEBHOOK_KEY_SECRET && envVars.WEBHOOK_KEY_SECRET.length < 32) {
    issues.critical.push('WEBHOOK_KEY_SECRET too short (minimum 32 characters)');
    log('  ✗ WEBHOOK_KEY_SECRET must be at least 32 characters', 'red');
  }
  
  if (envVars.GOCARDLESS_ENVIRONMENT && 
      !['sandbox', 'live'].includes(envVars.GOCARDLESS_ENVIRONMENT)) {
    issues.critical.push('GOCARDLESS_ENVIRONMENT must be "sandbox" or "live"');
    log('  ✗ GOCARDLESS_ENVIRONMENT must be "sandbox" or "live"', 'red');
  }
  
  // Warnings for optional but recommended
  if (!envVars.REDIS_URL) {
    issues.warnings.push('REDIS_URL not set - using in-memory rate limiting');
    log('  ⚠ REDIS_URL not set (acceptable for development)', 'yellow');
  }
  
  if (!envVars.ALLOWED_ORIGINS) {
    issues.warnings.push('ALLOWED_ORIGINS not set - CORS will use defaults');
    log('  ⚠ ALLOWED_ORIGINS not set', 'yellow');
  }
}

function checkRequiredFiles() {
  log('\n📁 Checking required files...', 'blue');
  
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'tailwind.config.ts',
    'drizzle.config.ts',
    '.gitignore',
    '.prettierrc',
    'eslint.config.mjs',
  ];
  
  requiredFiles.forEach(file => {
    const filePath = join(__dirname, '..', file);
    if (existsSync(filePath)) {
      log(`  ✓ ${file} exists`, 'green');
    } else {
      issues.critical.push(`${file} not found`);
      log(`  ✗ ${file} not found`, 'red');
    }
  });
}

function checkNodeVersion() {
  log('\n🔧 Checking Node.js version...', 'blue');
  
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 20) {
    log(`  ✓ Node.js ${currentVersion} (meets requirement >= 20.0.0)`, 'green');
  } else {
    issues.critical.push(`Node.js version ${currentVersion} is too old`);
    log(`  ✗ Node.js ${currentVersion} (requires >= 20.0.0)`, 'red');
  }
}

function checkPackageJson() {
  log('\n📦 Checking package.json...', 'blue');
  
  const pkgPath = join(__dirname, '..', 'package.json');
  
  if (!existsSync(pkgPath)) {
    issues.critical.push('package.json not found');
    log('  ✗ package.json not found', 'red');
    return;
  }
  
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  
  // Check required scripts
  const requiredScripts = ['dev', 'build', 'start', 'test', 'lint', 'format:check'];
  
  requiredScripts.forEach(script => {
    if (pkg.scripts && pkg.scripts[script]) {
      log(`  ✓ Script "${script}" defined`, 'green');
    } else {
      issues.warnings.push(`Script "${script}" not defined`);
      log(`  ⚠ Script "${script}" not defined`, 'yellow');
    }
  });
  
  // Check security dependencies
  const securityDeps = ['eslint-plugin-security', 'ioredis', 'zod'];
  
  securityDeps.forEach(dep => {
    if ((pkg.dependencies && pkg.dependencies[dep]) || 
        (pkg.devDependencies && pkg.devDependencies[dep])) {
      log(`  ✓ ${dep} installed`, 'green');
    } else {
      issues.warnings.push(`${dep} not installed`);
      log(`  ⚠ ${dep} not installed`, 'yellow');
    }
  });
}

function generateSecrets() {
  log('\n🔐 Need to generate secrets? Use these commands:', 'cyan');
  log('');
  log('  SESSION_SECRET:', 'cyan');
  log(`  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, 'yellow');
  log('');
  log('  WEBHOOK_KEY_SECRET:', 'cyan');
  log(`  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, 'yellow');
  log('');
}

function printSummary() {
  log('\n' + '='.repeat(70), 'blue');
  log('  Setup Validation Summary', 'blue');
  log('='.repeat(70), 'blue');
  
  if (issues.critical.length === 0 && issues.warnings.length === 0) {
    log('\n✨ All checks passed! Your setup is ready.', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Run: npm install', 'cyan');
    log('  2. Run: npm run db:push', 'cyan');
    log('  3. Run: npm run dev', 'cyan');
    return 0;
  }
  
  if (issues.critical.length > 0) {
    log('\n❌ Critical Issues Found:', 'red');
    issues.critical.forEach(issue => {
      log(`  • ${issue}`, 'red');
    });
  }
  
  if (issues.warnings.length > 0) {
    log('\n⚠️  Warnings:', 'yellow');
    issues.warnings.forEach(warning => {
      log(`  • ${warning}`, 'yellow');
    });
  }
  
  if (issues.critical.length > 0) {
    log('\n❌ Please fix critical issues before running the application.', 'red');
    return 1;
  } else {
    log('\n✓ No critical issues, but review warnings above.', 'yellow');
    return 0;
  }
}

// Main execution
async function main() {
  log('\n' + '='.repeat(70), 'blue');
  log('  FlowLoan Setup Validation', 'blue');
  log('='.repeat(70), 'blue');
  
  checkNodeVersion();
  checkRequiredFiles();
  checkPackageJson();
  checkEnvFile();
  generateSecrets();
  
  const exitCode = printSummary();
  process.exit(exitCode);
}

main();
