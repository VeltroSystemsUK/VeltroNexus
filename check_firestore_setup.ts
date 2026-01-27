import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function checkFirestoreSetup() {
    console.log("Checking Firestore setup...\n");

    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    console.log("Project ID:", projectId);

    if (!admin.apps.length) {
        admin.initializeApp({ projectId });
    }

    try {
        // Try to get the Firestore instance with the correct database ID
        const firestore = getFirestore('veltrodb');
        console.log("✓ Firestore instance created (veltrodb)");

        // Try to list databases (this will tell us what's available)
        console.log("\nAttempting to access Firestore...");

        // Try a simple operation
        const testDoc = firestore.collection('_test').doc('setup_check');
        await testDoc.set({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        });

        console.log("✓ Successfully wrote to Firestore!");

        const doc = await testDoc.get();
        console.log("✓ Successfully read from Firestore!");
        console.log("  Data:", doc.data());

        await testDoc.delete();
        console.log("✓ Successfully deleted from Firestore!");

        console.log("\n✅ Firestore is working correctly!");
        process.exit(0);

    } catch (error: any) {
        console.error("\n❌ Firestore check failed:");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);

        if (error.code === 5 || error.code === 'NOT_FOUND') {
            console.error("\n💡 Possible causes:");
            console.error("1. Firestore database not created in Firebase Console");
            console.error("2. Database created in Datastore mode instead of Native mode");
            console.error("3. Wrong project ID");
            console.error("\nPlease verify:");
            console.error("- Go to: https://console.firebase.google.com/project/veltro-prod/firestore");
            console.error("- Ensure Firestore is in 'Native mode' (not Datastore mode)");
            console.error("- Check that the database exists and is in the same project");
        }

        process.exit(1);
    }
}

checkFirestoreSetup();
