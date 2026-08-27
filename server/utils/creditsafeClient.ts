import fs from "fs";
import path from "path";

const BASE_URL = process.env.CREDITSAFE_BASE_URL || "https://connect.sandbox.creditsafe.com/v1";
const USERNAME = process.env.CREDITSAFE_USERNAME;
const PASSWORD = process.env.CREDITSAFE_PASSWORD;
// Per Creditsafe's confirmed sandbox entry sheet: "Number of reports: 50".
// Company search itself isn't listed as metered — only pulling a report is.
// Default leaves a small buffer under the real cap.
const REPORT_LIMIT = parseInt(process.env.CREDITSAFE_REPORT_LIMIT || "45", 10);
const TRIAL_END = process.env.CREDITSAFE_TRIAL_END; // e.g. "2026-10-06"

const USAGE_STORE = path.resolve(process.cwd(), "uploads", "creditsafe_usage.json");

type UsageLog = { count: number; calls: { at: string; companyId: string }[] };

function readUsage(): UsageLog {
    if (!fs.existsSync(USAGE_STORE)) return { count: 0, calls: [] };
    try {
        return JSON.parse(fs.readFileSync(USAGE_STORE, "utf8"));
    } catch {
        return { count: 0, calls: [] };
    }
}

function recordReportPull(companyId: string) {
    const usage = readUsage();
    usage.count += 1;
    usage.calls.push({ at: new Date().toISOString(), companyId });
    const dir = path.dirname(USAGE_STORE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USAGE_STORE, JSON.stringify(usage, null, 2));
}

function isExpired(): boolean {
    if (!TRIAL_END) return false;
    return new Date() > new Date(`${TRIAL_END}T23:59:59`);
}

export function creditsafeUsage() {
    const usage = readUsage();
    return {
        used: usage.count,
        limit: REPORT_LIMIT,
        remaining: Math.max(0, REPORT_LIMIT - usage.count),
        trialEndsAt: TRIAL_END || null,
        expired: isExpired(),
    };
}

function assertReportQuota() {
    const usage = creditsafeUsage();
    if (usage.expired) {
        throw new Error(`Creditsafe sandbox trial ended ${TRIAL_END} — contact Creditsafe to renew before pulling more reports.`);
    }
    if (usage.remaining <= 0) {
        throw new Error(
            `Creditsafe trial report quota exhausted (${usage.used}/${usage.limit} reports pulled). Raise CREDITSAFE_REPORT_LIMIT (real cap is 50) or upgrade the account before pulling more reports.`
        );
    }
}

// JWT token cache — Creditsafe tokens expire after 1 hour; refresh 5 minutes early.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function authenticate(): Promise<string> {
    if (!USERNAME || !PASSWORD) {
        throw new Error("CREDITSAFE_USERNAME / CREDITSAFE_PASSWORD not configured");
    }
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token;
    }
    const response = await fetch(`${BASE_URL}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Creditsafe authentication failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    if (!data.token) throw new Error("Creditsafe authentication response had no token");
    cachedToken = { token: data.token, expiresAt: Date.now() + 55 * 60 * 1000 };
    return data.token;
}

async function csFetch(urlPath: string): Promise<Response> {
    const token = await authenticate();
    return fetch(`${BASE_URL}${urlPath}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

export interface CreditsafeCompanyResult {
    id: string;
    name?: string;
    regNo?: string;
    address?: any;
    status?: string;
}

export const creditsafeClient = {
    usage: creditsafeUsage,

    // Logging in doesn't pull a report — safe to call freely.
    async testAuth(): Promise<boolean> {
        await authenticate();
        return true;
    },

    // Company search isn't metered against the 50-report cap — only view/pull
    // a report (getCompanyReport) actually spends one. UK-only — this trial
    // account has no international monitoring, no need for other countries.
    async searchCompanies(name: string): Promise<CreditsafeCompanyResult[]> {
        const params = new URLSearchParams({ countries: "GB", name });
        const response = await csFetch(`/companies?${params.toString()}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Creditsafe company search failed: ${response.status} ${text}`);
        }
        const data = await response.json();
        return (data.companies || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            regNo: c.regNo,
            address: c.address,
            status: c.status,
        }));
    },

    async getCompanyReport(companyId: string): Promise<any> {
        assertReportQuota();
        const response = await csFetch(`/companies/${encodeURIComponent(companyId)}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Creditsafe company report failed: ${response.status} ${text}`);
        }
        const data = await response.json();
        recordReportPull(companyId);
        return data;
    },
};

export default creditsafeClient;
