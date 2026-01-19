// Create a demo user with underwriting access
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const DATABASE_URL = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

async function createDemoUser() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Hash password: "demo123"
        const hashedPassword = await bcrypt.hash('demo123', 10);

        // Create demo user
        const result = await pool.query(`
      INSERT INTO users (
        id, email, password, first_name, last_name, 
        subscription_tier, role, prospect_limit, 
        has_underwriting_access, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 
        'demo@veltro.com', 
        $1, 
        'Demo', 
        'User',
        'broker',
        'broker',
        50,
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE 
      SET has_underwriting_access = 1
      RETURNING email, first_name, last_name
    `, [hashedPassword]);

        console.log('\n✅ Demo user created/updated!\n');
        console.log('📧 Email: demo@veltro.com');
        console.log('🔑 Password: demo123');
        console.log('🎯 Has underwriting access: YES\n');
        console.log('👉 Use these credentials to log in and test the feature!\n');

    } catch (error) {
        console.error('❌ Failed:', error.message);
    } finally {
        await pool.end();
    }
}

createDemoUser();
