import { db } from "./server/firebase";

async function testFirestore() {
    console.log("Testing Firestore connectivity...");

    try {
        // Test 1: Try to write a test document
        console.log("\n1. Testing write operation...");
        const testRef = db.collection('_test').doc('connectivity_test');
        await testRef.set({
            timestamp: new Date(),
            message: "Firestore is working!"
        });
        console.log("✓ Write successful");

        // Test 2: Try to read it back
        console.log("\n2. Testing read operation...");
        const doc = await testRef.get();
        if (doc.exists) {
            console.log("✓ Read successful:", doc.data());
        } else {
            console.log("✗ Document not found");
        }

        // Test 3: Try to delete it
        console.log("\n3. Testing delete operation...");
        await testRef.delete();
        console.log("✓ Delete successful");

        // Test 4: List collections
        console.log("\n4. Listing collections...");
        const collections = await db.listCollections();
        console.log("Available collections:", collections.map(c => c.id));

        console.log("\n✅ All Firestore tests passed!");
        process.exit(0);

    } catch (error: any) {
        console.error("\n❌ Firestore test failed:");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        process.exit(1);
    }
}

testFirestore();
