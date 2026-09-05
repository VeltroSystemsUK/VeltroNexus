import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { leadFinderSpawnSpec } from "../utils/shellArgs";

const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

const require = createRequire(import.meta.url);

// Path to Lead Agent CLI
const AGENT_DIR = path.join(process.cwd(), "server", "Lead Agent");
const CLI_PATH = "src/cli.ts"; // Path to TS CLI relative to AGENT_DIR

export interface LeadFinderStatus {
    total: number;
    enriched: number;
    emails_found: number;
    high_quality: number;
    pecr_eligible: number;
}

export interface LeadResult {
    place_id: string;
    name: string;
    rating: number | null;
    reviews: number | null;
    type: string | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    email: string | null;
    linkedin: string | null;
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
    lead_score: number | null;
    pecr_status: string | null;
}

export const leadFinderService = {
    /**
     * Run the agent with an instruction.
     * Returns a stream or promise that resolves when the process starts.
     * Since the agent takes time, we might just return "Started" and let the user poll via status/logs.
     */
    async runAgent(instruction: string, onOutput?: (data: string) => void): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(`[LeadFinder] Starting agent with instruction: "${instruction}"`);

            // Spawn tsx process
            // Assuming 'npx' is in path.
            const spec = leadFinderSpawnSpec(instruction, {
                execPath: process.execPath,
                tsxCli: TSX_CLI,
                cliPath: CLI_PATH,
            });
            const pythonProcess = spawn(spec.command, spec.args, {
                cwd: AGENT_DIR,
                shell: spec.shell,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8', TERM: 'dumb', FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
            });

            let outputBuffer = "";

            pythonProcess.stdout.on("data", (data) => {
                const text = data.toString();
                // console.log(`[LeadFinder] stdout: ${text}`);
                outputBuffer += text;
                if (onOutput) onOutput(text);
            });

            pythonProcess.stderr.on("data", (data) => {
                const text = data.toString();
                console.error(`[LeadFinder] stderr: ${text}`);
                if (onOutput) onOutput(`ERROR: ${text}`);
            });

            pythonProcess.on("close", (code) => {
                console.log(`[LeadFinder] process exited with code ${code}`);
                if (code === 0) {
                    resolve(outputBuffer);
                } else {
                    reject(new Error(`Agent process failed with code ${code}`));
                }
            });

            // If we want to return immediately and let it run in background:
            // resolve("Agent started in background");
            // But for now, let's wait for completion (simple v1) or just resolve.
            // The user experience is better if we wait for at least initial confirmation.
        });
    },

    /**
     * Get formatted status by running `src.cli status --json`
     * Note: The current CLI prints rich text, we might need to parse it or add a --json flag to CLI.
     * For now, we will regex parse the output.
     */
    async getStatus(): Promise<LeadFinderStatus> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(process.execPath, [TSX_CLI, CLI_PATH, "status"], {
                cwd: AGENT_DIR,
                shell: false,
                env: process.env
            });

            let output = "";
            let errorOutput = "";

            pythonProcess.stdout.on("data", (data) => output += data.toString());
            pythonProcess.stderr.on("data", (data) => errorOutput += data.toString());

            pythonProcess.on("close", (code) => {
                if (code !== 0) {
                    console.error("[LeadFinder] getStatus failed:", errorOutput);
                    // If it fails, maybe return zeros instead of crashing?
                    // return resolve({ total: 0, enriched: 0, emails_found: 0, high_quality: 0, pecr_eligible: 0 });
                    return reject(new Error(`Failed to get status: ${errorOutput}`));
                }

                // Parse Rich output (strip ansi if needed, but for now simple regex)
                // Example output:
                //   Total records:  12
                //   Enriched:       0

                const parse = (label: string) => {
                    const match = output.match(new RegExp(`${label}:\\s+(\\d+)`));
                    return match ? parseInt(match[1]) : 0;
                };

                resolve({
                    total: parse("Total records"),
                    enriched: parse("Enriched"),
                    emails_found: parse("Emails found"),
                    high_quality: parse("High quality"),
                    pecr_eligible: parse("PECR eligible"),
                });
            });
        });
    },

    /**
     * Get results by running `src.cli export --json`? 
     * Or direct DB access. 
     * Let's use `src.cli export --format json` (need to implement in CLI)
     * OR just read the CSV it exports.
     * 
     * Alternative: Read the SQLite DB directly since we have the path.
     */
    async getResults(limit = 100): Promise<LeadResult[]> {
        // Direct SQLite read is faster and easier in Node
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(AGENT_DIR, "lead_finder.db");

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
                if (err) return reject(err);
            });

            const sql = `
            SELECT 
                google_place_id as place_id,
                name,
                rating,
                review_count as reviews,
                status as type,
                address,
                phone,
                website,
                email,
                lead_score,
                pecr_status
            FROM businesses 
            ORDER BY scraped_at DESC 
            LIMIT ?
          `;

            db.all(sql, [limit], (err: Error | null, rows: any[]) => {
                db.close();
                if (err) return reject(err);
                resolve(rows as LeadResult[]);
            });
        });
    }
};
