
import { db } from "./server/firebase";

async function checkLenders() {
    console.log("Checking Lenders Data...");
    const snap = await db.collection('lenders').where('isGlobal', '==', 1).limit(5).get();

    if (snap.empty) {
        console.log("No global lenders found.");
    } else {
        snap.docs.forEach(d => {
            const data = d.data();
            console.log(`Lender: ${data.institutionName}`);
            console.log(`LogoURL: ${data.logoUrl}`);
            console.log('---');
        });
    }
    process.exit(0);
}

checkLenders();
