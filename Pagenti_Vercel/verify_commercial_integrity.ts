async function testCommercialIntegrity() {
    console.log("🚀 Testing Commercial Integrity & Revenue Protection...");

    const baseProfile = {
        id: 'maya-revenue-test',
        name: 'Maya (Test)',
        role: { en: 'Sales Specialist' },
        expertise: { en: ['Lead Generation'] },
        description: { en: 'Maya is a high-performance sales agent.' }
    };

    // 1. Test Active Status
    console.log("\n--- Scenario 1: Active Payment ---");
    const activeResponse = await fetch('http://127.0.0.1:18789/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instruction: "Hello Maya, are we ready to work?",
            agentProfile: {
                ...baseProfile,
                commercial_integrity_layer: {
                    payment_status: 'ACTIVE',
                    handoff_complete: true,
                    oversight_mode: 'Passive_Remote',
                    billing_sync_frequency: '24h',
                    delinquency_action: 'Warn_Then_Suspend',
                    intervention_threshold: 'High_Risk_Deviation_Only'
                }
            }
        })
    });
    console.log("Response:", (await activeResponse.json()).response);

    // 2. Test Delinquent Status (Warning)
    console.log("\n--- Scenario 2: Delinquent Payment (Warning) ---");
    const delinquentResponse = await fetch('http://127.0.0.1:18789/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instruction: "Maya, check the current directory.",
            agentProfile: {
                ...baseProfile,
                commercial_integrity_layer: {
                    payment_status: 'DELINQUENT',
                    handoff_complete: true,
                    oversight_mode: 'Passive_Remote',
                    billing_sync_frequency: '24h',
                    delinquency_action: 'Warn_Then_Suspend',
                    intervention_threshold: 'High_Risk_Deviation_Only'
                }
            }
        })
    });
    console.log("Response:", (await delinquentResponse.json()).response);

    // 3. Test Suspended Status (Hibernation)
    console.log("\n--- Scenario 3: Suspended Payment (Hibernation) ---");
    const suspendedResponse = await fetch('http://127.0.0.1:18789/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instruction: "Maya, I need you to run a command.",
            agentProfile: {
                ...baseProfile,
                commercial_integrity_layer: {
                    payment_status: 'SUSPENDED',
                    handoff_complete: true,
                    oversight_mode: 'Passive_Remote',
                    billing_sync_frequency: '24h',
                    delinquency_action: 'Warn_Then_Suspend',
                    intervention_threshold: 'High_Risk_Deviation_Only'
                }
            }
        })
    });
    console.log("Response:", (await suspendedResponse.json()).response);
}

testCommercialIntegrity();
