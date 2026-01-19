
const { drizzle } = require("drizzle-orm/node-postgres");
const { pgTable, varchar, integer, timestamp, text } = require("drizzle-orm/pg-core");
const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const underwritingSubmissions = pgTable("underwriting_submissions", {
    id: integer("id").primaryKey(),
    prospectId: integer("prospect_id"),
    brokerId: varchar("broker_id"),
    assignedUnderwriterId: varchar("assigned_underwriter_id"),
    status: varchar("status"),
    createdAt: timestamp("created_at"),
});

async function main() {
    console.log("Checking recent submissions...");
    try {
        const result = await db.select().from(underwritingSubmissions).limit(5).orderBy(underwritingSubmissions.createdAt);
        console.log("Found", result.length, "submissions:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

main();
