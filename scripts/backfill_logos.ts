import { db } from "../server/firebase";
import { findLogoUrl } from "../server/utils/logoFetcher";

async function backfillLogos() {
    console.log("Starting logo backfill...");

    try {
        const lendersRef = db.collection("lenders");
        const snapshot = await lendersRef.get();

        if (snapshot.empty) {
            console.log("No lenders found.");
            return;
        }

        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        const docs = snapshot.docs;
        console.log(`Found ${docs.length} lenders to check.`);

        // Process in batches or sequentially to avoid rate limits if any
        for (const doc of docs) {
            const data = doc.data();
            const name = data.institutionName;
            const website = data.website || "";

            processed++;

            if (data.logoUrl) {
                // Maybe re-check if it's a broken link? For now, skip if present.
                skipped++;
                continue;
            }

            console.log(`[${processed}/${docs.length}] Checking logo for: ${name} (${website})...`);

            try {
                const result = await findLogoUrl({ website, name });

                if (result.logoUrl) {
                    await doc.ref.update({ logoUrl: result.logoUrl });
                    console.log(`  -> UPDATED: ${result.logoUrl} (Source: ${result.source})`);
                    updated++;
                } else {
                    console.log(`  -> No logo found.`);
                }
            } catch (err) {
                console.error(`  -> Error processing ${name}:`, err);
                failed++;
            }

            // Small delay to be nice to APIs
            await new Promise(r => setTimeout(r, 200));
        }

        console.log("------------------------------------------------");
        console.log("Backfill Complete.");
        console.log(`Total: ${docs.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped (Already had logo): ${skipped}`);
        console.log(`Failed: ${failed}`);
        console.log("------------------------------------------------");

    } catch (error) {
        console.error("Backfill script failed:", error);
    } finally {
        process.exit(0);
    }
}

// Check environment variables
if (!process.env.TAVILY_API_KEY) {
    console.warn("WARNING: TAVILY_API_KEY is not set. Fallback search will fail.");
}

backfillLogos();
