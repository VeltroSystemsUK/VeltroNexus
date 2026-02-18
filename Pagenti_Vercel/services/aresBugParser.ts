/**
 * ARES BUG REPORT PARSER
 * Transforms vague human feedback into actionable system protocols.
 */

import { GoogleGenAI } from "@google/genai";
import { AresBugTicket } from "../types";

// Reusing the configuration from geminiService (conceptually)
const GEMINI_MODEL = "gemini-2.0-flash";

const cleanAndParseJSON = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            let cleanText = text.replace(/```json\s*|\s*```/g, "").trim();
            cleanText = cleanText.replace(/```\s*|\s*```/g, "").trim();
            return JSON.parse(cleanText);
        } catch (e2) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(text.substring(start, end + 1));
            }
            throw e2;
        }
    }
}

export const analyzeBugReport = async (userFeedback: string, telemetryLogs?: string): Promise<AresBugTicket> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        const prompt = `
        IDENTITY: You are ARES, the Self-Healing System Architect.
        OBJECTIVE: Analyze the user feedback and optional telemetry logs to generate a structured Bug Ticket.

        INPUT DATA:
        User Feedback: "${userFeedback}"
        Telemetry Logs: "${telemetryLogs || 'None provided'}"

        ARES PIPELINE:
        1. Semantic Translation: Translate vague complaints (e.g. "glitchy") into technical terms (e.g. "latency spike").
        2. Root Cause Analysis: Is this a Logic Error (Code), Acoustic Error (ElevenLabs), or UI Error (Frontend)?
        3. Risk Categorization:
           - P0 (Critical): Crash, Security, Auth
           - P1 (Operational): Logic failure, API error
           - P2 (UX/UI): Visual glitches, confusing text

        OUTPUT SPECIFICATION:
        Return a single JSON object matching the 'AresBugTicket' structure.
        
        {
          "ticket_metadata": {
            "issue_id": "BUG-2026-XXX",
            "reporter": "User_Feedback",
            "priority": "P0 - Critical" | "P1 - Operational" | "P2 - UX/UI"
          },
          "diagnostic_report": {
            "symptom": "Technical description of the issue",
            "root_cause": "The specific technical reason",
            "telemetry_log": "Relevant error codes or logs"
          },
          "proposed_resolution": {
            "fix_type": "Code_Patch" | "Config_Update" | "Rollback",
            "action": "Specific action to take",
            "impact_analysis": "Effect of the fix"
          },
          "ares_certification": {
            "status": "Awaiting_Human_Approval",
            "safety_toggle": "Active"
          }
        }
        
        CRITICAL: Return ONLY valid JSON with no markdown formatting.
        `;

        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        });

        const responseText = (result as any).text || "{}";
        return cleanAndParseJSON(responseText) as AresBugTicket;

    } catch (e) {
        console.error("[ARES] Bug Report Analysis Failed:", e);
        // Fallback ticket
        return {
            ticket_metadata: {
                issue_id: `BUG-${Date.now()}`,
                reporter: "System_Fallback",
                priority: "P1 - Operational"
            },
            diagnostic_report: {
                symptom: "Automatic Analysis Failed",
                root_cause: "Unknown - Manual investigation required",
                telemetry_log: String(e)
            },
            proposed_resolution: {
                fix_type: "Config_Update",
                action: "Review logs manually",
                impact_analysis: "Unknown"
            },
            ares_certification: {
                status: "Awaiting_Human_Approval",
                safety_toggle: "Active"
            }
        };
    }
};
