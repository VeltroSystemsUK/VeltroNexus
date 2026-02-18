import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export interface FinancialHealth {
    netAssets: number | null;
    cash: number | null;
    creditors: number | null;
    shareholderFunds: number | null;
    crisisRatio: number | null;
    filingDate?: string;
    docType?: string;
    currency?: string;
    logs?: string[];
}

export class IxbrlService {
    async auditCompany(companyNumber: string): Promise<FinancialHealth> {
        try {
            const scriptPath = path.resolve(process.cwd(), "scripts", "ixbrl_parser.py");

            // Execute python script
            // Pass env vars explicitly, ensuring API key is present
            const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${companyNumber}"`, {
                maxBuffer: 1024 * 1024 * 5, // 5MB
                env: process.env // Inherit all env vars (including API Key from .env loaded by app)
            });

            if (stderr) {
                // Python might print to stderr for logs, not always error.
                // Check if stdout is empty/JSON.
            }

            console.log(`[iXBRL] Raw Output for ${companyNumber}: ${stdout.substring(0, 200)}...`); // Log first 200 chars

            const result = JSON.parse(stdout.trim());

            if (result.error) {
                console.warn(`[iXBRL] Audit failed for ${companyNumber}: ${result.error}`);
                if (result.logs) {
                    console.warn(`[iXBRL] Debug Logs:\n${result.logs.join("\n")}`);
                }
                return this.getEmptyMetrics();
            }

            return {
                netAssets: result.netAssets,
                cash: result.cash,
                creditors: result.creditors,
                shareholderFunds: result.shareholderFunds,
                crisisRatio: result.crisisRatio,
                filingDate: result.filingDate,
                docType: result.docType,
                currency: result.currency || "GBP",
                logs: result.logs
            };

        } catch (error) {
            console.error(`[iXBRL] Execution error for ${companyNumber}:`, error);
            return this.getEmptyMetrics();
        }
    }

    private getEmptyMetrics(): FinancialHealth {
        return {
            netAssets: null,
            cash: null,
            creditors: null,
            shareholderFunds: null,
            crisisRatio: null
        };
    }
}

export const ixbrlService = new IxbrlService();
