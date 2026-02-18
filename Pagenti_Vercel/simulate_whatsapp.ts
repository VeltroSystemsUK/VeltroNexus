async function simulateWhatsAppMessage() {
    console.log("🧪 ARES-Pagenti WhatsApp Integration Test");
    console.log("----------------------------------------");

    const mockWhatsAppPayload = {
        object: "whatsapp_business_account",
        entry: [{
            id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    metadata: {
                        display_phone_number: "16505551111",
                        phone_number_id: "123456123456"
                    },
                    contacts: [{
                        profile: { name: "Shaun" },
                        wa_id: "16505550000"
                    }],
                    messages: [{
                        from: "16505550000",
                        id: "wamid.HBgLMTY1MDU1NTAwMDBAFgIVEFRBN0M5RTlBRUJBQUE",
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: { body: "ARES, initiate system diagnostic." },
                        type: "text"
                    }]
                },
                field: "messages"
            }]
        }]
    };

    console.log("➡️ Simulating WhatsApp Webhook (Port 18790)...");
    try {
        const response = await fetch('http://localhost:18790/webhook/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockWhatsAppPayload)
        });

        if (response.ok) {
            console.log("✅ Webhook Received by Surface.");
            console.log("\nCheck the Surface Terminal for routing logs!");
        } else {
            console.error("❌ Webhook Failed. Is the Surface Connector running on 18790?");
        }
    } catch (e) {
        console.error("❌ Connection failed. Run 'npx tsx src/surfaces/whatsappConnector.ts' in another terminal.");
    }
}

simulateWhatsAppMessage();
