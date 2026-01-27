
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 FIRESTORE AUTH DIAGNOSTIC TOOL\n' + '='.repeat(40));

// 1. Check current directory
console.log(`\n📂 Working Directory: ${process.cwd()}`);

// 2. Check for serviceAccountKey.json
const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (fs.existsSync(keyPath)) {
    console.log('✅ serviceAccountKey.json found!');
    try {
        const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log(`   Project ID in file: ${key.project_id}`);
        console.log(`   Client Email: ${key.client_email}`);
    } catch (e) {
        console.log('❌ Error reading key file:', e.message);
    }
} else {
    console.log('❌ serviceAccountKey.json NOT found in root directory');
}

// 3. Check Environment Variables
console.log('\n🌍 Environment Variables Check:');
const envVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
];

let hasEnvAuth = false;
envVars.forEach(v => {
    const exists = !!process.env[v];
    console.log(`   ${v}: ${exists ? 'SET ✅' : 'NOT SET ❌'}`);
    if (exists) hasEnvAuth = true;
});

if (!hasEnvAuth && !fs.existsSync(keyPath)) {
    console.log('\n⚠️  CRITICAL: No authentication method found!');
    console.log('   Please download serviceAccountKey.json to root OR set environment variables.');
}

// 4. Test Connection
console.log('\n🔌 Testing Firestore Connection...');

if (admin.apps.length === 0) {
    try {
        const config = {};
        if (process.env.FIREBASE_PROJECT_ID) {
            config.credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            });
            console.log('   Using Environment Credentials');
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log('   Using GOOGLE_APPLICATION_CREDENTIALS path');
            // Auto-handled by default app init if var is set
            config.credential = admin.credential.applicationDefault();
        } else if (fs.existsSync(keyPath)) {
            config.credential = admin.credential.cert(require(keyPath));
            console.log('   Using serviceAccountKey.json');
        }

        if (!Object.keys(config).length) {
            // fallback
            config.credential = admin.credential.applicationDefault();
        }

        admin.initializeApp(config);
    } catch (e) {
        console.log('❌ Init Error:', e.message);
    }
}

async function testDb() {
    try {
        const db = admin.firestore();
        const testDoc = await db.collection('diagnostics').doc('auth_test').get();
        console.log(`\n✅ SUCCESS! Connected to Firestore.`);
        if (testDoc.exists) console.log('   Read permissions: OK');
        else console.log('   Read permissions: OK (Doc empty)');

        console.log('\nYour authentication setup is working correctly.');
    } catch (error) {
        console.log('\n❌ CONNECTION FAILED:');
        console.log(error.message);
        if (error.code === 7) console.log('   (Permission Denied - Check IAM roles or Rules)');
        if (error.code === 16) console.log('   (Unauthorized - Check Project ID / Key)');
    }
}

testDb();
