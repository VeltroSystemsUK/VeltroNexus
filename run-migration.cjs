// Simple migration script to add underwriting access fields
const { Pool } = require('pg');
const fs = require('fs');

// Read DATABASE_URL from .env file
const envContent = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
const DATABASE_URL = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔄 Running migration...\n');

    // Add columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS has_underwriting_access INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Added has_underwriting_access column');

    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS underwriting_access_expires_at TIMESTAMP
    `);
    console.log('✅ Added underwriting_access_expires_at column');

    // Grant access to lender tier users
    const result1 = await pool.query(`
      UPDATE users 
      SET has_underwriting_access = 1 
      WHERE subscription_tier = 'lender'
    `);
    console.log(`✅ Granted access to ${result1.rowCount} lender tier users`);

    // Grant access to underwriter role users
    const result2 = await pool.query(`
      UPDATE users 
      SET has_underwriting_access = 1 
      WHERE role = 'underwriter'
    `);
    console.log(`✅ Granted access to ${result2.rowCount} underwriter role users`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('   You can now restart your dev server and test the AI underwriting feature.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
