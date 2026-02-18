
import { leadFinderService } from "./server/services/leadFinderService";

async function main() {
    console.log("Testing getResults...");
    try {
        const results = await leadFinderService.getResults(5);
        console.log("Results:", results);
    } catch (e) {
        console.error("getResults failed:", e);
    }

    console.log("Testing getStatus...");
    try {
        const status = await leadFinderService.getStatus();
        console.log("Status:", status);
    } catch (e) {
        console.error("getStatus failed:", e);
    }
}

main();
