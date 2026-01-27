#!/usr/bin/env node

/**
 * Veltro Authentication Quick Fix Tool
 * 
 * This script attempts to automatically fix common authentication and configuration issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

type ColorKey = keyof typeof colors;

function log(message: string, color: ColorKey = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
    log(`✓ ${message}`, 'green');
}

function info(message: string) {
    log(`ℹ ${message}`, 'blue');
}

function warning(message: string) {
    log(`⚠ ${message}`, 'yellow');
}

async function createEnvFile() {
    log('\n📝 Creating .env file...', 'bright');

    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');

    if (fs.existsSync(envPath)) {
        const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            info('Skipping .env creation');
            return;
        }
    }

    // Generate a strong session secret
    const sessionSecret = crypto.randomBytes(32).toString('hex');

    let envContent = '';

    if (fs.existsSync(envExamplePath)) {
        envContent = fs.readFileSync(envExamplePath, 'utf8');
        // Replace placeholder session secret
        envContent = envContent.replace(/SESSION_SECRET=.*/g, `SESSION_SECRET=${sessionSecret}`);
    } else {
        // Create basic .env template
        envContent = `# Server Configuration
NODE_ENV=development
PORT=5000

# Session Configuration
SESSION_SECRET=${sessionSecret}

# Google Cloud / Firebase Configuration
# Option 1: Use service account key file
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Option 2: Use individual Firebase credentials
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"

# Companies House API (UK company lookups)
# COMPANIES_HOUSE_API_KEY=your-api-key

# Optional: Email configuration
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASS=your-app-password

# Optional: Stripe (for payments)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    success('.env file created with secure session secret');
    info(`Session secret generated: ${sessionSecret.substring(0, 10)}...`);
}

async function setupFirebaseCredentials() {
    log('\n🔥 Firebase Credentials Setup', 'bright');

    console.log('\nChoose authentication method:');
    console.log('1. Service Account Key File (Recommended)');
    console.log('2. Environment Variables');

    const choice = await question('Enter choice (1 or 2): ');

    if (choice === '1') {
        await setupServiceAccountFile();
    } else if (choice === '2') {
        await setupFirebaseEnvVars();
    } else {
        warning('Invalid choice. Skipping Firebase setup.');
    }
}

async function setupServiceAccountFile() {
    info('\nService Account Key File Setup:');
    console.log('\nSteps:');
    console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
    console.log('2. Click "Generate New Private Key"');
    console.log('3. Save the JSON file');

    const filePath = await question('\nEnter path to your service account JSON file: ');

    if (!filePath) {
        warning('No file path provided. Skipping.');
        return;
    }

    const resolvedPath = path.resolve(filePath.trim().replace(/['"]/g, ''));

    if (!fs.existsSync(resolvedPath)) {
        warning(`File not found: ${resolvedPath}`);
        return;
    }

    // Validate JSON
    try {
        const content = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

        if (content.type !== 'service_account') {
            warning('This does not appear to be a service account key file');
            return;
        }

        success('Valid service account key file detected');
        info(`Project ID: ${content.project_id}`);
        info(`Client Email: ${content.client_email}`);

        // Copy to project root if not already there
        const destPath = path.join(process.cwd(), 'serviceAccountKey.json');

        if (resolvedPath !== destPath) {
            const copy = await question(`Copy file to ${destPath}? (Y/n): `);
            if (copy.toLowerCase() !== 'n') {
                fs.copyFileSync(resolvedPath, destPath);
                success(`Copied to ${destPath}`);
            }
        }

        // Update .env file
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');

            // Update or add GOOGLE_APPLICATION_CREDENTIALS
            if (envContent.includes('GOOGLE_APPLICATION_CREDENTIALS=')) {
                envContent = envContent.replace(
                    /GOOGLE_APPLICATION_CREDENTIALS=.*/g,
                    'GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json'
                );
            } else {
                envContent += '\nGOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json\n';
            }

            fs.writeFileSync(envPath, envContent, 'utf8');
            success('Updated .env file with credentials path');
        }

        // Add to .gitignore
        const gitignorePath = path.join(process.cwd(), '.gitignore');
        let gitignoreContent = fs.existsSync(gitignorePath)
            ? fs.readFileSync(gitignorePath, 'utf8')
            : '';

        if (!gitignoreContent.includes('serviceAccountKey.json')) {
            gitignoreContent += '\n# Firebase credentials\nserviceAccountKey.json\n';
            fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
            success('Added serviceAccountKey.json to .gitignore');
        }

    } catch (err: any) {
        warning(`Error processing file: ${err.message}`);
    }
}

async function setupFirebaseEnvVars() {
    info('\nFirebase Environment Variables Setup:');

    console.log('\nYou will need:');
    console.log('- Project ID');
    console.log('- Client Email (from service account)');
    console.log('- Private Key (from service account)');

    const projectId = await question('\nEnter Firebase Project ID: ');
    const clientEmail = await question('Enter Client Email: ');

    console.log('\nEnter Private Key (paste entire key including BEGIN/END lines):');
    const privateKey = await question('Private Key: ');

    if (!projectId || !clientEmail || !privateKey) {
        warning('Incomplete information. Skipping.');
        return;
    }

    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Update or add Firebase variables
        const updates = [
            ['FIREBASE_PROJECT_ID', projectId],
            ['FIREBASE_CLIENT_EMAIL', clientEmail],
            ['FIREBASE_PRIVATE_KEY', privateKey.replace(/\n/g, '\\n')],
        ];

        updates.forEach(([key, value]) => {
            const regex = new RegExp(`${key}=.*`, 'g');
            if (envContent.includes(`${key}=`)) {
                envContent = envContent.replace(regex, `${key}="${value}"`);
            } else {
                envContent += `\n${key}="${value}"\n`;
            }
        });

        fs.writeFileSync(envPath, envContent, 'utf8');
        success('Updated .env file with Firebase credentials');
    }
}

async function fixSessionConfig() {
    log('\n🔧 Checking Session Configuration...', 'bright');

    const authFilePath = path.join(process.cwd(), 'server', 'auth.ts');

    if (!fs.existsSync(authFilePath)) {
        warning('server/auth.ts not found. Cannot fix session config.');
        return;
    }

    let authContent = fs.readFileSync(authFilePath, 'utf8');
    let modified = false;

    // Check for problematic secure: true in development
    if (authContent.includes('secure: true') && !authContent.includes('process.env.NODE_ENV')) {
        info('Found hardcoded secure: true in cookie config');

        const fix = await question('Fix to use environment-based secure flag? (Y/n): ');
        if (fix.toLowerCase() !== 'n') {
            authContent = authContent.replace(
                /secure:\s*true/g,
                'secure: process.env.NODE_ENV === "production"'
            );
            modified = true;
            success('Updated secure flag to be environment-aware');
        }
    }

    // Check for missing sameSite
    if (authContent.includes('cookie:') && !authContent.includes('sameSite:')) {
        info('sameSite attribute not found in cookie config');

        const fix = await question('Add sameSite: "lax" to cookie config? (Y/n): ');
        if (fix.toLowerCase() !== 'n') {
            authContent = authContent.replace(
                /(cookie:\s*{[^}]*)/g,
                '$1\n    sameSite: "lax",'
            );
            modified = true;
            success('Added sameSite attribute');
        }
    }

    if (modified) {
        // Backup original
        fs.writeFileSync(authFilePath + '.backup', authContent, 'utf8');
        fs.writeFileSync(authFilePath, authContent, 'utf8');
        success('Updated server/auth.ts (backup created)');
    } else {
        success('Session configuration looks good');
    }
}

async function createStartScript() {
    log('\n📜 Creating convenience scripts...', 'bright');

    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }

        // Add useful scripts if missing
        const scriptsToAdd = {
            'diagnose': 'node diagnose-auth.js',
            'fix-auth': 'node fix-auth.js',
            'dev:clean': 'rm -rf dist && npm run dev',
        };

        let added = false;
        Object.entries(scriptsToAdd).forEach(([name, script]) => {
            if (!packageJson.scripts[name]) {
                packageJson.scripts[name] = script;
                added = true;
                success(`Added script: npm run ${name}`);
            }
        });

        if (added) {
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
            success('Updated package.json');
        }
    }
}

async function showNextSteps() {
    log('\n✅ Setup Complete!', 'bright');

    console.log('\n📋 Next Steps:');
    console.log('1. Verify your .env file has all required variables');
    console.log('2. Run: npm run diagnose (to verify configuration)');
    console.log('3. Run: npm install (if you haven\'t already)');
    console.log('4. Run: npm run dev (to start development server)');

    console.log('\n🔍 If issues persist:');
    console.log('• Check server logs for specific error messages');
    console.log('• Verify Firebase project settings match your credentials');
    console.log('• Try: gcloud auth application-default login');

    console.log('\n');
}

async function main() {
    log('🔧 Veltro Authentication Quick Fix Tool\n', 'bright');

    console.log('This tool will help you fix common authentication issues.\n');

    const steps = [
        { name: 'Create/Update .env file', fn: createEnvFile },
        { name: 'Setup Firebase credentials', fn: setupFirebaseCredentials },
        { name: 'Fix session configuration', fn: fixSessionConfig },
        { name: 'Add convenience scripts', fn: createStartScript },
    ];

    for (const step of steps) {
        const proceed = await question(`\n${step.name}? (Y/n): `);
        if (proceed.toLowerCase() !== 'n') {
            await step.fn();
        }
    }

    await showNextSteps();

    rl.close();
}

main().catch(err => {
    console.error('\nFix tool failed:', err);
    process.exit(1);
});
