import { db } from "../server/firebase";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";

// Ensure logos directory exists
const logosDir = path.resolve("client/public/logos");
if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        if (!res.body) throw new Error("No body");

        // Use Node.js stream to write file
        // @ts-ignore - native fetch body is a ReadableStream, but fs needs Node Readable
        const stream = Readable.fromWeb(res.body);
        const file = fs.createWriteStream(dest);
        await finished(stream.pipe(file));
        return true;
    } catch (err) {
        // console.error(`Failed to download ${url}:`, err);
        return false;
    }
}

async function start() {
    console.log("Starting Logo Migration...");
    const lendersRef = db.collection("lenders");
    const snapshot = await lendersRef.get();

    if (snapshot.empty) {
        console.log("No lenders found.");
        return;
    }

    console.log(`Checking ${snapshot.size} lenders...`);
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const logoUrl = data.logoUrl;

        if (!logoUrl) continue;

        // Skip if already local
        if (logoUrl.startsWith("/logos/")) {
            skipped++;
            continue;
        }

        if (!logoUrl.startsWith("http")) {
            // Unknown format, skip
            continue;
        }

        // Determine extension (default png)
        let ext = "png";
        if (logoUrl.includes(".ico")) ext = "ico";
        if (logoUrl.includes(".jpg") || logoUrl.includes(".jpeg")) ext = "jpg";
        if (logoUrl.includes(".svg")) ext = "svg";

        const filename = `${doc.id}.${ext}`;
        const localPath = path.join(logosDir, filename);
        const publicPath = `/logos/${filename}`;

        console.log(`Downloading for ${data.institutionName}: ${logoUrl}`);

        const success = await downloadFile(logoUrl, localPath);

        if (success) {
            await doc.ref.update({ logoUrl: publicPath });
            // console.log(`  -> Saved to ${publicPath}`);
            downloaded++;
        } else {
            console.log(`  -> Failed to download.`);
            // Maybe fallback to nothing? or keep external url?
            // Keep external for now so we don't lose data, but maybe clear it if it's dead?
            // User wants to "scrape all...". Dead link = no logo.
            failed++;
        }

        // delay
        await new Promise(r => setTimeout(r, 100));
    }

    console.log("--------------------------------");
    console.log(`Migration Complete.`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped (Local): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log("--------------------------------");
    process.exit(0);
}

start();
