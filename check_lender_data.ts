
import { db } from "./server/firebase";

async function checkLenders() {
    console.log("Checking Lenders Data...");
    const snap = await db.collection('lenders').where('isGlobal', '==', 1).limit(5).get();

    const allSnap = await db.collection('lenders').where('isGlobal', '==', 1).get();
    console.log(`Total Global Lenders: ${allSnap.size}`);

    if (snap.empty) {
        console.log("No global lenders found.");
    } else {
        snap.docs.forEach(d => {
            const data = d.data();
            console.log(`Lender: ${data.institutionName}`);
            console.log(`LogoURL: ${data.logoUrl}`);
            console.log(`ProductTypes: ${JSON.stringify(data.productTypes)}`);
            console.log(`PanelStatus: ${data.panelStatus}`);
            console.log('---');
        });
    }
    process.exit(0);
}

checkLenders();
