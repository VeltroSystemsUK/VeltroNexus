import express from 'express';
import cors from 'cors';
import { AresFrameSchema } from './schemas';
import { agentRunner } from '../runner/AgentRunner';
// No Ajv yet, let's just do basic check for now to keep it simple or install it
// Actually let's assume TypeBox for just typing and handle minimal validation manually or install ajv

const app = express();
const PORT = 18789;

app.use(cors());

// Raw Logger to see if anything hits us
app.use((req, res, next) => {
    console.log(`[NETWORK] ${req.method} ${req.url}`);
    next();
});

app.use(express.json());

process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🌊 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', agent: 'ARES-Pagenti Gateway', version: '0.1.0' });
});

app.post('/frame', async (req, res) => {
    const frame = req.body;

    // Basic validation
    if (!frame.type || !frame.payload) {
        return res.status(400).json({ success: false, error: 'Invalid frame structure' });
    }

    console.log(`[ARES Gateway] Inbound Frame: ${frame.type} from ${frame.metadata?.source || 'unknown'}`);

    // Route to Agent Runner
    try {
        const responseText = await agentRunner.processInstruction(
            frame.payload.text || JSON.stringify(frame.payload),
            frame.metadata?.sessionId || 'default'
        );

        res.json({
            success: true,
            message: 'Processed by Agent Runner',
            data: {
                response: responseText,
                sessionId: frame.metadata?.sessionId
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Agent Runner execution failed' });
    }
});

/**
 * DIRECT EXECUTION ENDPOINT
 * Used by the pAGENTi Web App to talk to specific agents
 */
app.post('/execute', async (req, res) => {
    const { instruction, agentProfile, sessionId } = req.body;

    if (!instruction) {
        return res.status(400).json({ success: false, error: 'Missing instruction' });
    }

    try {
        const responseText = await agentRunner.processInstruction(
            instruction,
            sessionId || 'default',
            agentProfile
        );

        res.json({
            success: true,
            response: responseText
        });
    } catch (e: any) {
        console.error("[ARES Gateway] Execution Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/proactive', async (req, res) => {
    const { agentId } = req.query;
    // For demo, we just use a generic agent profile if not found
    const agentProfile = { name: agentId || 'ARES' };

    try {
        const insight = await agentRunner.getProactiveInsight(agentProfile);
        res.json({ success: true, insight });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

console.log("🚦 Gateway Script Initializing...");

app.listen(PORT, () => {
    console.log(`🚀 ARES-Pagenti Gateway running on port ${PORT}`);
    setInterval(() => {
        // console.log('💓 Heartbeat');
    }, 10000);
});

process.on('exit', (code) => {
    console.log(`🛑 Gateway process exiting with code: ${code}`);
});
