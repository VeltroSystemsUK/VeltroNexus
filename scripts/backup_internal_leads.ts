import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function backupInternalLeads() {
    // Dynamic import to ensure env vars are loaded first
    const { storage } = await import("../server/storage");

    console.log("Starting Internal Leads Backup...");

    // Check for count-only flag
    const countOnly = process.argv.includes("--count-only");

    // 1. Fetch all internal leads
    const leads = await storage.listInternalLeads();
    console.log(`Found ${leads.length} internal leads in database.`);

    if (countOnly) {
        console.log("Count-only mode. Exiting.");
        return;
    }

    // 2. Create backups directory if it doesn't exist
    const backupsDir = path.resolve(__dirname, "backups");
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    // 3. Create timestamped backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupsDir, `internal_leads_backup_${timestamp}.json`);

    // 4. Write backup
    fs.writeFileSync(backupPath, JSON.stringify(leads, null, 2), "utf-8");
    console.log(`✅ Backup created: ${backupPath}`);

    // 5. Verify backup
    const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    if (backupData.length === leads.length) {
        console.log(`✅ Backup verified: ${backupData.length} records`);
    } else {
        console.error(`❌ Backup verification failed! Expected ${leads.length}, got ${backupData.length}`);
        process.exit(1);
    }

    console.log("\n--------------------------");
    console.log("Backup Complete");
    console.log(`Total Records: ${leads.length}`);
    console.log(`Backup Location: ${backupPath}`);
    console.log("--------------------------");
}

backupInternalLeads().catch(console.error);
