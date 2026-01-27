import { db } from "../server/firebase.js";

async function fixLogoPaths() {
    console.log("Starting Logo Path Fixer...");
    const lendersRef = db.collection("lenders");
    const snapshot = await lendersRef.get();

    if (snapshot.empty) {
        console.log("No lenders found.");
        return;
    }

    console.log(`Checking ${snapshot.size} lenders...`);
    let fixed = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const logoUrl = data.logoUrl;

        if (logoUrl) {
            console.log(`Checking ${data.institutionName}: ${logoUrl}`);
            if (logoUrl.startsWith("file:") || logoUrl.includes("client") || logoUrl.includes("Users")) {
                // Extract filename from the end of the path
                const filename = logoUrl.split(/[/\\]/).pop();
                const newPath = `/logos/${filename}`;

                console.log(`   -> Fixing: ${logoUrl} -> ${newPath}`);
                await doc.ref.update({ logoUrl: newPath });
                fixed++;
            }
        }
    }

    console.log("--------------------------------");
    console.log(`Fix Complete. Total fixed: ${fixed}`);
    console.log("--------------------------------");
    process.exit(0);
}

fixLogoPaths().catch(err => {
    console.error("Fix failed:", err);
    process.exit(1);
});
