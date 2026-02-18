/**
 * ARES CHAT SERVICE
 * Enables conversational interaction with the Ares Architect.
 */

import { GoogleGenAI } from "@google/genai";
import { AresProposal } from "../types";
import { parseUserDirective } from "./aresDirectiveParser";

const GEMINI_MODEL = "gemini-2.0-flash";

export interface ChatMessage {
    id: string;
    role: 'user' | 'ares';
    content: string;
    timestamp: string;
    proposal?: AresProposal; // Ares can attach a proposal to a message
    isTyping?: boolean;
}

export const chatWithAres = async (
    history: ChatMessage[],
    newMessage: string
): Promise<{ text: string; proposal?: AresProposal }> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        // 1. First, check if this is a DIRECTIVE that needs parsing?
        // We use a lighter check or just always convert to conversation, 
        // asking the LLM if it SHOULD generate a proposal.

        const systemPrompt = `
        IDENTITY: You are ARES, the Sovereign System Architect of Pagenti.
        PERSONA: Professional, highly intelligent, precise, slightly futuristic, efficient. Think "Jarvis" meets "Chief Engineer".
        RELATIONSHIP: The User is the "Super Admin" or "Commander". You act as their trusted employee/executive assistant.

        CONTEXT:
        You are embedded in the "Ares Architect Dashboard".
        You have control over:
        1. Agent Generation (Building new agents)
        2. UI Customization (Changing colors, layout)
        3. Infrastructure Scaling
        
        INSTRUCTIONS:
        - Respond conversationally to the user.
        - If the user asks for an action (e.g., "Build an agent", "Change color"), explicitly state you are drafting a proposal.
        - Keep responses concise (under 3 sentences unless explaining complex logic).
        - If you generate a proposal, wrap the technical details in a special block: ||PROPOSAL_TRIGGER||

        CURRENT CONVERSATION:
        ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
        USER: ${newMessage}
        
        OUTPUT format: Just text response.
        `;

        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: systemPrompt }] }]
        });

        const responseText = (result as any).text || "System offline.";

        // 2. Logic to detect if we need a proposal
        // If the LLM implies action, we verify with the directive parser
        const lowerRes = responseText.toLowerCase();
        const lowerMsg = newMessage.toLowerCase();

        let proposal: AresProposal | undefined;

        // Heuristic: If user asks to build, create, change, or update, TRY to parse a proposal
        // Or if ARES says "I have drafted a proposal"
        if (
            lowerMsg.includes('build') ||
            lowerMsg.includes('create') ||
            lowerMsg.includes('change') ||
            lowerMsg.includes('update') ||
            lowerRes.includes('proposal')
        ) {
            try {
                // We specifically ask the parser to treat this message as a directive
                const p = await parseUserDirective(newMessage);
                // Only attach if it seems valid/relevant
                if (p.type !== 'UI_OPTIMIZATION' || p.title !== 'Directive Parsing Error') {
                    proposal = p;
                }
            } catch (e) {
                // Ignore parsing errors in chat mode, just chat
            }
        }

        return {
            text: responseText.replace('||PROPOSAL_TRIGGER||', ''),
            proposal: proposal
        };

    } catch (e) {
        console.error("[ARES] Chat Failed:", e);
        return { text: "Communication link unstable. Please repeat." };
    }
};
