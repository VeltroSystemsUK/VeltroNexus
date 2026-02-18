/**
 * ARES DIRECTIVE PARSER
 * Transforms user natural language commands into structured technical proposals.
 */

import { GoogleGenAI } from "@google/genai";
import { AresProposal } from "../types";

const GEMINI_MODEL = "gemini-2.0-flash";

const cleanAndParseJSON = (text: string): any => {
    try {
        let cleanText = text.replace(/```json\s*|\s*```/g, "").trim();
        cleanText = cleanText.replace(/```\s*|\s*```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        throw e;
    }
}

export const parseUserDirective = async (userDriver: string): Promise<AresProposal> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        const prompt = `
        IDENTITY: You are ARES, the System Architect.
        OBJECTIVE: specific user directive: "${userDriver}"
        
        TASK: Convert this natural language request into a FORMAL SYSTEM PROPOSAL.

        SCENARIO 1: Cosmetic/UI Change
        Input: "Make the header blue"
        Output: Type="UI_OPTIMIZATION", affected_component="Header", ui_changes=[{component:"Header", current_state:"Default", proposed_state:"Blue background"}]

        SCENARIO 2: New Agent Build
        Input: "Build a Legal Assistant"
        Output: Type="AGENT_GENERATION", affected_component="AgentForge", title="New Agent: Legal Assistant", description="Generation of specialized legal capability."

        OUTPUT SPECIFICATION:
        Return a single valid JSON object matching the 'AresProposal' interface.
        
        {
          "id": "prop-${Date.now()}",
          "type": "UI_OPTIMIZATION" | "AGENT_GENERATION" | "INFRASTRUCTURE_SCALING",
          "severity": "LOW" | "MODERATE" | "HIGH",
          "timestamp": "${new Date().toISOString()}",
          "title": "Short professional title",
          "description": "Technical description of the request",
          "rationale": "User Directive: ${userDriver}",
          "affected_component": "string",
          "ui_changes": [ ... ],
          "estimated_impact": {
            "user_experience_improvement": "string",
            "risk_level": "LOW",
            "rollback_plan": "string"
          },
          "status": "PENDING",
          "approval_required": true,
          "auto_deploy_allowed": false,
          "created_by": "USER_DIRECTIVE"
        }
        
        CRITICAL: Return ONLY valid JSON.
        `;

        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        });

        const responseText = (result as any).text || "{}";
        return cleanAndParseJSON(responseText) as AresProposal;

    } catch (e) {
        console.error("[ARES] Directive Parsing Failed:", e);
        // Fallback proposal
        return {
            id: `err-${Date.now()}`,
            type: 'UI_OPTIMIZATION',
            severity: 'LOW',
            timestamp: new Date().toISOString(),
            title: 'Directive Parsing Error',
            description: `Failed to parse directive: ${userDriver}`,
            rationale: 'System Error',
            affected_component: 'AresDirectiveParser',
            ui_changes: [],
            estimated_impact: {
                user_experience_improvement: 'None',
                risk_level: 'LOW',
                rollback_plan: 'None'
            },
            status: 'REJECTED',
            approval_required: false,
            auto_deploy_allowed: false,
            created_by: 'SYSTEM'
        };
    }
};
