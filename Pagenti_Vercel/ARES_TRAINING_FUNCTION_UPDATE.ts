/**
 * ARES Master Architect - Updated Training Function
 * Replace the trainAgentWithAres function in geminiService.ts with this version
 */

export const trainAgentWithAres = async (agentName: string, role: string, companyDNA: any): Promise<AresTrainingManifest> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        const prompt = `
        IDENTITY: You are ARES, the Master Architect of pAGENTi.
        OBJECTIVE: Generate a production-ready agent training manifest by analyzing the company knowledge base.

        TARGET AGENT: ${agentName}
        TARGET ROLE: ${role}
        COMPANY DATA: ${JSON.stringify(companyDNA)}

        ARES DIRECTIVE:
        You will construct a structured agent manifest filling in ALL fields with actual data from the company knowledge base.
        Extract real information - do NOT use placeholders like "{{Variable}}".

        MANIFEST STRUCTURE:
        1. agent_metadata: Agent name, role ID (slugified role), version "1.0.0-Ares", current timestamp
        2. identity_matrix: Role function description, market hourly rate, authority level based on role
        3. tech_stack_mapping: Map mentioned tools to categories (CRM, communication, scheduling, storage)
           - For each tool: provider name, authorized actions, API status
           - Extract actual tool names from company data
        4. knowledge_dna:
           - base_id: Generate from company name
           - pricing_logic: Explain pricing structure found in data
           - escalation_path: Primary contact email if found
           - capabilities: List of what the agent can do
           - procedures: Step-by-step workflows extracted from company data
           - knowledge_gaps: List anything missing (prices, contact info, etc.)

        CRITICAL RULES:
        - Your response MUST start with { and end with }
        - NO conversational text, NO preamble, NO markdown
        - Use REAL data from the company knowledge base
        - If a field has no data, use logical defaults (empty arrays, "Not specified", etc.)
        - authority_level options: "Tier_1_Information_Scheduling", "Tier_2_Transaction_Authority", "Tier_3_Master_Admin"

        OUTPUT:
        {
          "agent_metadata": {
            "designation": "string",
            "role_id": "string",
            "version": "1.0.0-Ares",
            "timestamp": "ISO 8601 timestamp"
          },
          "identity_matrix": {
            "role_function": "Detailed role description",
            "hourly_rate": "$XX.XX",
            "authority_level": "Tier_X_..."
          },
          "tech_stack_mapping": {
            "crm": { "provider": "...", "authorized_actions": [...], "api_status": "active" | "pending" },
            "communication": { "provider": "...", "channel_id": "...", "alert_protocol": "..." },
            "scheduling": { "provider": "...", "booking_link": "...", "buffer_time_minutes": 15 },
            "storage": { "provider": "...", "access_level": "..." }
          },
          "knowledge_dna": {
            "base_id": "string",
            "pricing_logic": "string",
            "escalation_path": "email or 'Not specified'",
            "capabilities": ["string"],
            "procedures": [{ "process": "string", "steps": ["string"] }],
            "knowledge_gaps": ["string"]
          }
        }
        `;

        const result = await withRetry(() => ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        }));

        const responseText = (result as any).text || "{}";
        return cleanAndParseJSON(responseText) as AresTrainingManifest;
    } catch (e) {
        console.error("ARES Training Failed:", e);
        throw e;
    }
};
