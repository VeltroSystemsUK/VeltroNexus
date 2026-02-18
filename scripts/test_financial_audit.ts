import { financialAuditService } from "../server/services/financialAuditService";

/**
 * Test Financial Health Audit
 */

const testCompanies = [
    // Companies with diverse filing types (likely Micro-entity/Abridged)
    { name: "Revolut Ltd", number: "09446001" },
    { name: "Local SME Construction", number: "10729845" } // Example: random number, might fail if not real or no accounts
];

async function testAudit() {
    console.log("=== Testing Financial Health Audit (iXBRL Parsing) ===\n");

    for (const co of testCompanies) {
        console.log(`Auditing: ${co.name} (${co.number})`);
        try {
            const metrics = await financialAuditService.auditFinancials(co.number);
            console.log("Metrics Found:");
            console.log("- Cash at Bank:", metrics.cashAtBank ? `£${metrics.cashAtBank.toLocaleString()}` : "Not found");
            console.log("- Creditors <1yr:", metrics.creditorsDueWithinOneYear ? `£${metrics.creditorsDueWithinOneYear.toLocaleString()}` : "Not found");
            console.log("- Net Assets:", metrics.netAssets ? `£${metrics.netAssets.toLocaleString()}` : "Not found");

            if (metrics.crisisRatio) {
                console.log(`- CRISIS RATIO: ${metrics.crisisRatio.toFixed(2)}x (Creditors/Cash)`);
                if (metrics.crisisRatio > 1.5) console.log("  ⚠️  LIQUIDITY WARNING");
            }
            console.log("-".repeat(40));
        } catch (e) {
            console.error("Audit failed:", e);
        }
    }
}

testAudit().catch(console.error);
