async function testAgentExecution() {
    console.log("🚀 Testing Local Agent Vitalization (v2)...");

    try {
        const response = await fetch('http://127.0.0.1:18789/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instruction: "Hello Maya, can you list the files in the current directory to show you have access?",
                agentProfile: {
                    id: 'maya-sales',
                    name: 'Maya',
                    role: { en: 'Sales Specialist' },
                    expertise: { en: ['Lead Generation'] },
                    tools: ['File System', 'Terminal'],
                    description: { en: 'Maya is a high-performance sales agent.' }
                },
                sessionId: 'test-session-maya'
            })
        });

        const text = await response.text();
        console.log("\nRAW RESPONSE START:", text.substring(0, 50), "...");

        let data: any;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("\n❌ FAILED to parse JSON. Full response body:");
            console.error(text);
            return;
        }

        console.log("\n🤖 Agent Response:");
        console.log(data.response);

        if (data.response && data.response.includes('[COMMAND OUTPUT]')) {
            console.log("\n✅ SUCCESS: Agent successfully executed a local command!");
        } else {
            console.log("\n⚠️ WARNING: Agent responded but did not execute a command.");
        }
    } catch (e: any) {
        console.error("\n❌ FAILED: Could not reach Gateway.", e.message);
    }
}

testAgentExecution();
