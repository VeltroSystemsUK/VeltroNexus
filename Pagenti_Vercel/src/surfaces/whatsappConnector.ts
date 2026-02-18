import express from 'express';
import { AresFrameSchema } from '../gateway/schemas';

const app = express();
const PORT = 18790; // Dedicated port for WhatsApp Surface
const GATEWAY_URL = 'http://localhost:18789/frame';

app.use(express.json());

app.get('/', (req, res) => {
    res.send('✅ ARES WhatsApp Surface is ONLINE. Use /webhook/whatsapp for the Meta Webhook URL.');
});

/**
 * WhatsApp Webhook Verification (Meta Standard)
 */
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'ares_verify_token') {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

/**
 * Incoming Message Webhook
 */
app.post('/webhook/whatsapp', async (req, res) => {
    const body = req.body;

    // Log the raw incoming payload
    console.log('[WhatsApp Surface] Inbound Webhook:', JSON.stringify(body, null, 2));

    // Basic extraction (Meta Cloud API Structure)
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
        const contact = value.contacts?.[0];
        const from = message.from; // Phone number
        const text = message.text?.body;

        console.log(`[WhatsApp Surface] Message from ${contact?.profile?.name || from}: ${text}`);

        // 1. Translate to ARES Frame
        const aresFrame = {
            id: message.id,
            type: 'USER_MESSAGE',
            payload: { text },
            metadata: {
                source: 'WhatsApp',
                timestamp: new Date().toISOString(),
                sessionId: `whatsapp-${from}`
            }
        };

        // 2. Forward to Local Gateway
        try {
            const gatewayResponse = await fetch(GATEWAY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(aresFrame)
            });

            const result: any = await gatewayResponse.json();

            // 3. Handle Egress (Send response back to WhatsApp)
            if (result.success && result.data?.response) {
                console.log(`[WhatsApp Surface] ARES Response: ${result.data.response}`);
                // In a real implementation: Call Meta Cloud API to send message back
                // sendWhatsAppMessage(from, result.data.response);
            }

        } catch (e) {
            console.error('[WhatsApp Surface] Failed to reach ARES Gateway:', e);
        }
    }

    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`📲 WhatsApp Surface Connector running on port ${PORT}`);
    console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
});
