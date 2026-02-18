import { AresFrameSchema } from './src/gateway/schemas.ts';

async function runTest() {
    console.log("🧪 ARES-Pagenti Local OS Test Runner\n");

    const testFrame = {
        id: `test-${Date.now()}`,
        type: 'USER_MESSAGE',
        payload: {
            text: "Hello ARES, list my local files."
        },
        metadata: {
            source: 'WhatsApp-Simulation',
            timestamp: new Date().toISOString(),
            sessionId: 'user-001'
        }
    };

    console.log("➡️ Sending Test Frame to Gateway (18789)...");
    try {
        const response = await fetch('http://localhost:18789/frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testFrame)
        });

        const result = await response.json();
        console.log("⬅️ Gateway Response:", JSON.stringify(result, null, 2));

        if (result.success) {
            console.log("\n✅ Test Successful: Gateway acknowledged and routed the frame.");
        } else {
            console.error("\n❌ Test Failed: Gateway returned error.");
        }
    } catch (e) {
        console.error("\n❌ Test Failed: Could not connect to Gateway. Is it running?");
        console.log("Tip: Run 'npx tsx src/gateway/index.ts' in another terminal first.");
    }
}

runTest();
