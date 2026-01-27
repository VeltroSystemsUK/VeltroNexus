#!/usr/bin/env node

/**
 * Veltro Authentication & Configuration Diagnostic Tool
 * 
 * This script checks your environment configuration, Google Cloud authentication,
 * and session setup to identify issues preventing the application from running properly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

type ColorKey = keyof typeof colors;

function log(message: string, color: ColorKey = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
    console.log('\n' + '='.repeat(60));
    log(title, 'bright');
    console.log('='.repeat(60));
}

function success(message: string) {
    log(`✓ ${message}`, 'green');
}

function warning(message: string) {
    log(`⚠ ${message}`, 'yellow');
}

function error(message: string) {
    log(`✗ ${message}`, 'red');
}

function info(message: string) {
    log(`ℹ ${message}`, 'blue');
}

interface Diagnostics {
    envFile: boolean;
    googleCredsFile: boolean;
    googleCredsEnv: boolean;
    firebaseConfig: boolean;
    sessionSecret: boolean;
    gcloudAuth: boolean;
    nodeVersion: boolean;
    npmPackages: boolean;
    issues: string[];
    warnings: string[];
}

// Diagnostic checks
const diagnostics: Diagnostics = {
    envFile: false,
    googleCredsFile: false,
    googleCredsEnv: false,
    firebaseConfig: false,
    sessionSecret: false,
    gcloudAuth: false,
    nodeVersion: false,
    npmPackages: false,
    issues: [],
    warnings: [],
};

async function checkNodeVersion() {
    section('1. Node.js Version Check');
    try {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);

        info(`Node.js version: ${version}`);

        if (major >= 18) {
            success('Node.js version is compatible (>= 18)');
            diagnostics.nodeVersion = true;
        } else {
            error('Node.js version is too old. Please upgrade to Node 18 or higher');
            diagnostics.issues.push('Node.js version < 18');
        }
    } catch (err: any) {
        error(`Failed to check Node version: ${err.message}`);
    }
}

async function checkEnvFile() {
    section('2. Environment File Check');

    const envPath = path.join(process.cwd(), '.env');

    if (fs.existsSync(envPath)) {
        success('.env file found');
        diagnostics.envFile = true;

        try {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n');

            // Check for critical variables
            const criticalVars = [
                'SESSION_SECRET',
                'GOOGLE_APPLICATION_CREDENTIALS',
                'FIREBASE_PROJECT_ID',
                'FIREBASE_CLIENT_EMAIL',
                'FIREBASE_PRIVATE_KEY',
            ];

            const foundVars: Record<string, boolean> = {};
            lines.forEach(line => {
                const [key] = line.split('=');
                if (key && criticalVars.includes(key.trim())) {
                    foundVars[key.trim()] = true;
                }
            });

            info('\nEnvironment variables check:');
            criticalVars.forEach(varName => {
                if (foundVars[varName]) {
                    success(`  ${varName} is set`);
                    if (varName === 'SESSION_SECRET') diagnostics.sessionSecret = true;
                    if (varName === 'GOOGLE_APPLICATION_CREDENTIALS') diagnostics.googleCredsEnv = true;
                } else {
                    warning(`  ${varName} is NOT set`);
                    diagnostics.warnings.push(`Missing environment variable: ${varName}`);
                }
            });

            // Check if SESSION_SECRET is strong enough
            if (foundVars['SESSION_SECRET']) {
                const secretMatch = envContent.match(/SESSION_SECRET=(.+)/);
                if (secretMatch) {
                    const secret = secretMatch[1].trim().replace(/['"]/g, '');
                    if (secret.length < 32) {
                        warning('  SESSION_SECRET is less than 32 characters (weak)');
                        diagnostics.warnings.push('Weak SESSION_SECRET');
                    }
                }
            }

        } catch (err: any) {
            error(`Error reading .env file: ${err.message}`);
        }
    } else {
        error('.env file NOT found');
        diagnostics.issues.push('Missing .env file');
        info('Create a .env file based on .env.example');
    }
}

async function checkGoogleCredentials() {
    section('3. Google Cloud Credentials Check');

    // Check for credentials file via environment variable
    const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credsPath) {
        info(`GOOGLE_APPLICATION_CREDENTIALS: ${credsPath}`);

        if (fs.existsSync(credsPath)) {
            success('Credentials file exists');
            diagnostics.googleCredsFile = true;

            try {
                const credsContent = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

                if (credsContent.type === 'service_account') {
                    success('Valid service account credentials file');
                    info(`  Project ID: ${credsContent.project_id}`);
                    info(`  Client Email: ${credsContent.client_email}`);
                } else {
                    warning('Credentials file is not a service account key');
                    diagnostics.warnings.push('Non-service-account credentials');
                }
            } catch (err: any) {
                error(`Invalid JSON in credentials file: ${err.message}`);
                diagnostics.issues.push('Invalid credentials file format');
            }
        } else {
            error(`Credentials file does not exist at: ${credsPath}`);
            diagnostics.issues.push('Credentials file not found');
        }
    } else {
        warning('GOOGLE_APPLICATION_CREDENTIALS not set in environment');

        // Check common locations
        const commonPaths = [
            path.join(process.cwd(), 'serviceAccountKey.json'),
            path.join(process.cwd(), 'credentials.json'),
            path.join(process.cwd(), 'firebase-credentials.json'),
        ];

        let found = false;
        for (const testPath of commonPaths) {
            if (fs.existsSync(testPath)) {
                warning(`Found credentials file at: ${testPath}`);
                info('  Consider setting GOOGLE_APPLICATION_CREDENTIALS to this path');
                found = true;
                break;
            }
        }

        if (!found) {
            error('No service account key file found in common locations');
            diagnostics.issues.push('No Google credentials configured');
        }
    }
}

async function checkFirebaseEnvVars() {
    section('4. Firebase Environment Variables Check');

    const firebaseVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
    ];

    let allPresent = true;
    firebaseVars.forEach(varName => {
        if (process.env[varName]) {
            success(`${varName} is set`);
        } else {
            error(`${varName} is NOT set`);
            allPresent = false;
        }
    });

    if (allPresent) {
        diagnostics.firebaseConfig = true;
        success('All Firebase environment variables are configured');
    } else {
        error('Some Firebase environment variables are missing');
        diagnostics.issues.push('Incomplete Firebase configuration');
    }
}

async function checkGCloudAuth() {
    section('5. gcloud CLI Authentication Check');

    try {
        const { stdout } = await execAsync('gcloud auth list --format=json');
        const accounts = JSON.parse(stdout);

        const activeAccount = accounts.find((acc: any) => acc.status === 'ACTIVE');

        if (activeAccount) {
            success('gcloud CLI is authenticated');
            info(`  Active account: ${activeAccount.account}`);
            diagnostics.gcloudAuth = true;
        } else {
            warning('gcloud CLI has no active account');
            info('  Run: gcloud auth application-default login');
            diagnostics.warnings.push('No active gcloud account');
        }
    } catch (err: any) {
        warning('gcloud CLI not found or not authenticated');
        info('  Install gcloud CLI: https://cloud.google.com/sdk/docs/install');
        info('  Then run: gcloud auth application-default login');
        diagnostics.warnings.push('gcloud not configured');
    }
}

async function checkNpmPackages() {
    section('6. Critical npm Packages Check');

    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        const criticalPackages = [
            '@google-cloud/firestore',
            'express-session',
            'passport',
            'passport-local',
            'dotenv',
        ];

        info('Checking critical packages:');
        criticalPackages.forEach(pkg => {
            if (dependencies[pkg]) {
                success(`  ${pkg}@${dependencies[pkg]}`);
            } else {
                error(`  ${pkg} is NOT installed`);
                diagnostics.issues.push(`Missing package: ${pkg}`);
            }
        });

        diagnostics.npmPackages = true;
    } else {
        error('package.json not found');
        diagnostics.issues.push('No package.json file');
    }
}

async function checkSessionConfig() {
    section('7. Session Configuration Check');

    // Try to load server files to check session config
    const authFilePath = path.join(process.cwd(), 'server', 'auth.ts');

    if (fs.existsSync(authFilePath)) {
        const authContent = fs.readFileSync(authFilePath, 'utf8');

        // Check for session configuration
        if (authContent.includes('express-session')) {
            success('express-session is imported');
        } else {
            error('express-session not found in auth.ts');
        }

        // Check for cookie settings
        if (authContent.includes('cookie:')) {
            success('Cookie configuration found');

            // Check for common issues
            if (authContent.includes('secure: true') && !authContent.includes('process.env.NODE_ENV === "production"')) {
                warning('secure: true is set without environment check (may cause issues in development)');
                diagnostics.warnings.push('Cookie secure flag may block local development');
            }

            if (authContent.includes('sameSite:')) {
                success('sameSite attribute is configured');
            } else {
                warning('sameSite attribute not explicitly set');
            }
        } else {
            warning('No explicit cookie configuration found');
        }
    } else {
        warning('Could not locate server/auth.ts for detailed session check');
    }
}

async function generateReport() {
    section('DIAGNOSTIC SUMMARY');

    const checks: Record<string, boolean> = {
        'Node.js Version': diagnostics.nodeVersion,
        'Environment File': diagnostics.envFile,
        'Session Secret': diagnostics.sessionSecret,
        'Google Credentials File': diagnostics.googleCredsFile,
        'Firebase Environment Config': diagnostics.firebaseConfig,
        'gcloud Authentication': diagnostics.gcloudAuth,
        'npm Packages': diagnostics.npmPackages,
    };

    console.log('\nStatus Overview:');
    Object.entries(checks).forEach(([check, passed]) => {
        if (passed) {
            success(check);
        } else {
            error(check);
        }
    });

    if (diagnostics.issues.length > 0) {
        console.log('\n❌ CRITICAL ISSUES:');
        diagnostics.issues.forEach((issue, i) => {
            error(`  ${i + 1}. ${issue}`);
        });
    }

    if (diagnostics.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        diagnostics.warnings.forEach((warning, i) => {
            log(`  ${i + 1}. ${warning}`, 'yellow');
        });
    }

    section('RECOMMENDED ACTIONS');

    if (!diagnostics.googleCredsFile && !diagnostics.firebaseConfig) {
        console.log('\n🔧 Fix Google Cloud Authentication:');
        info('1. Create a service account in Google Cloud Console');
        info('2. Download the JSON key file');
        info('3. Save it as serviceAccountKey.json in your project root');
        info('4. Add to .env: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json');
        info('   OR');
        info('5. Add Firebase credentials directly to .env:');
        info('   FIREBASE_PROJECT_ID=your-project-id');
        info('   FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com');
        info('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    }

    if (!diagnostics.sessionSecret) {
        console.log('\n🔧 Fix Session Secret:');
        info('1. Generate a strong random secret:');
        info('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        info('2. Add to .env: SESSION_SECRET=<generated-secret>');
    }

    if (!diagnostics.gcloudAuth) {
        console.log('\n🔧 Setup gcloud CLI (Alternative):');
        info('1. Install gcloud: https://cloud.google.com/sdk/docs/install');
        info('2. Run: gcloud auth application-default login');
        info('3. Follow the browser authentication flow');
    }

    console.log('\n📚 Additional Resources:');
    info('• Firebase Setup: https://firebase.google.com/docs/admin/setup');
    info('• Service Accounts: https://cloud.google.com/iam/docs/service-accounts');
    info('• Express Session: https://github.com/expressjs/session');

    console.log('\n');
}

// Main execution
async function main() {
    log('🔍 Veltro Authentication Diagnostic Tool\n', 'bright');

    // Load .env file if it exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        try {
            const dotenv = await import('dotenv');
            dotenv.config({ path: envPath });
        } catch (err) {
            warning('dotenv package not found, skipping .env loading');
        }
    }

    await checkNodeVersion();
    await checkEnvFile();
    await checkGoogleCredentials();
    await checkFirebaseEnvVars();
    await checkGCloudAuth();
    await checkNpmPackages();
    await checkSessionConfig();
    await generateReport();
}

main().catch(err => {
    error(`\nDiagnostic tool failed: ${err.message}`);
    console.error(err);
    process.exit(1);
});
