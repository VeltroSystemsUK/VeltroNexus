import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { DeltaOutput } from "../data/deltaCalculator";

const execAsync = promisify(exec);

/**
 * Refinancing Workflow Service
 * Orchestrates the SOP flow: Lead Gen -> Discovery -> Report
 */

export class RefinancingWorkflowService {

    /**
     * Generate Cash Flow Recovery Report PDF
     * Calls the Python script to generate the PDF using a temp file for input data
     */
    async generateRecoveryReport(
        companyName: string,
        delta: DeltaOutput,
        currentMonthly: number,
        currentRate: number
    ): Promise<string> {
        console.log(`[Workflow] Generating report for ${companyName}...`);

        const reportData = {
            companyName,
            currentMonthly,
            currentRate,
            newMonthly: delta.refinanceMonthly,
            newRate: 8.5, // Target Rate
            monthlySaving: delta.monthlySaving,
            annualSaving: delta.annualSaving,
            valuationImpactLow: delta.valuationImpact.low,
            valuationImpactHigh: delta.valuationImpact.high
        };

        const tempFile = path.join(os.tmpdir(), `report_data_${Date.now()}.json`);

        try {
            // Write JSON to temp file to avoid command line escaping issues
            await fs.writeFile(tempFile, JSON.stringify(reportData));

            const { stdout, stderr } = await execAsync(
                `python scripts/generate_recovery_report.py "${tempFile}"`
            );

            if (stderr) {
                console.error("[Workflow] Report generation stderr:", stderr);
            }

            console.log("[Workflow] Report generation output:", stdout);

            // Extract filename from stdout (assuming script prints "SUCCESS: filename")
            const match = stdout.match(/SUCCESS: (.*\.pdf)/);
            return match ? match[1] : "";

        } catch (error) {
            console.error("[Workflow] Report generation failed:", error);
            throw error;
        } finally {
            // Cleanup temp file
            await fs.unlink(tempFile).catch(() => { });
        }
    }
}

export const refinancingWorkflow = new RefinancingWorkflowService();
