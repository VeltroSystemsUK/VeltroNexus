// Grant demo access to current user
const { Pool } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const DATABASE_URL = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function grantDemoAccess() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Grant access to all users for demo
        const result = await pool.query(`
      UPDATE users 
      SET has_underwriting_access = 1 
      WHERE id IN (SELECT id FROM users LIMIT 10)
    `);
        console.log(`✅ Granted underwriting access to ${result.rowCount} users for demo`);
        console.log('   Refresh your browser to see the UnderwriterInbox!\n');
    } catch (error) {
        console.error('❌ Failed:', error.message);
    } finally {
        await pool.end();
    }
}

grantDemoAccess();
