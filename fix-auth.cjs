
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
const ENV_FILE = '.env';

console.log('\n🛠️  FIRESTORE AUTH FIX WIZARD\n' + '='.repeat(40));

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function start() {
    console.log('\nThis tool will help you set up Firebase Authentication.');
    console.log('You need a service account JSON file from Firebase Console.');
    console.log('(Settings -> Service Accounts -> Generate New Private Key)\n');

    if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
        console.log(`✅ ${SERVICE_ACCOUNT_FILE} already exists. Skipping creation.`);
    } else {
        console.log(`⚠️  ${SERVICE_ACCOUNT_FILE} missing.`);
        const content = await ask('Paste the JSON content here (or press Enter to skip if you have .env vars): ');

        if (content.trim().startsWith('{')) {
            fs.writeFileSync(SERVICE_ACCOUNT_FILE, content.trim());
            console.log(`✅ Saved ${SERVICE_ACCOUNT_FILE}`);
        } else {
            console.log('Skipped file creation.');
        }
    }

    // Check .env
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
        envContent = fs.readFileSync(ENV_FILE, 'utf8');
    }

    if (!envContent.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
        console.log('\nUpdating .env with GOOGLE_APPLICATION_CREDENTIALS...');
        fs.appendFileSync(ENV_FILE, `\nGOOGLE_APPLICATION_CREDENTIALS=./${SERVICE_ACCOUNT_FILE}\n`);
        console.log('✅ Added to .env');
    } else {
        console.log('\n✅ .env already has GOOGLE_APPLICATION_CREDENTIALS');
    }

    console.log('\n🎉 Setup Complete! Run "node diagnose-auth.js" to verify.');
    rl.close();
}

start();
