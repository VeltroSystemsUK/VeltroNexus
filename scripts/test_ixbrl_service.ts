import { ixbrlService } from "../server/services/ixbrlService";

async function runTest() {
    // List of companies to test
    // 13674550: SH PLANNING LAW
    // 09664551: MONZO BANK LIMITED (Should be digital)
    // 02050399: ALD AUTOMOTIVE LIMITED (Large)
    // 00445790: TESCO PLC (Likely PDF)
    const companies = ["13674550", "09664551", "02050399", "00445790"];

    for (const coNum of companies) {
        console.log(`\nTesting iXBRL Audit for ${coNum}...`);
        try {
            const result = await ixbrlService.auditCompany(coNum);
            console.log(`Result for ${coNum}:`, JSON.stringify(result, null, 2));

            if (result.crisisRatio !== null || result.netAssets !== null) {
                console.log("✅ SUCCESS!");
            } else {
                console.log("❌ FAILED (Empty Metrics)");
            }

        } catch (e) {
            console.error(e);
        }
    }
}

runTest();
