/**
 * ARES Autonomous Knowledge Gap Patching - Updated Version
 * Replace the aresDirectPatchKnowledgeGaps function in geminiService.ts with this version
 */

export const aresDirectPatchKnowledgeGaps = async (
    agentName: string,
    role: string,
    manifest: AresTrainingManifest,
    report: UselessnessReport,
    companyDNA: any
): Promise<AresTrainingManifest> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        const prompt = `
        IDENTITY: You are ARES, the Master Architect - supreme authority in agent construction.
        OBJECTIVE: DIRECTLY PATCH knowledge gaps in ${agentName}'s training manifest using your architectural authority.

        CURRENT MANIFEST (WITH GAPS):
        ${JSON.stringify(manifest, null, 2)}

        DIAGNOSTIC REPORT (GAPS IDENTIFIED):
        ${JSON.stringify(report, null, 2)}

        COMPANY DNA (SOURCE OF TRUTH):
        ${JSON.stringify(companyDNA, null, 2)}

        ARES DIRECTIVE:
        You have detected logical holes in ${agentName}'s knowledge base. As Master Architect, you will NOW:

        1. ANALYZE each gap reported in the diagnostic
        2. SYNTHESIZE the missing knowledge from Company DNA  
        3. CONSTRUCT precise, actionable additions to fill each gap
        4. INTEGRATE these patches directly into the manifest

        PATCH TARGETS:
        - knowledge_dna.knowledge_gaps: Should become empty array after patching
        - knowledge_dna.capabilities: Add missing capabilities
        - knowledge_dna.procedures: Add missing workflows
        - knowledge_dna.pricing_logic: Fill in pricing details
        - tech_stack_mapping: Add missing integrations
        - identity_matrix.authority_level: Upgrade if needed

        CRITICAL RULES:
        - Return the COMPLETE manifest with ALL gaps filled
        - Your response MUST start with { and end with }
        - NO conversational text, NO preamble, NO markdown
        - Maintain ALL existing data, only ADD missing information
        - Set knowledge_dna.knowledge_gaps to [] if all gaps are filled

        OUTPUT: Return the complete, patched AresTrainingManifest as valid JSON.
        `;

        const result = await withRetry(() => ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        }), 3, 6000);

        const responseText = (result as any).text || "{}";
        const patchedManifest = cleanAndParseJSON(responseText) as AresTrainingManifest;

        console.log(`[ARES] Knowledge gaps patched autonomously. ${agentName} is now certified.`);
        return patchedManifest;
    } catch (e) {
        console.error("ARES Autonomous Patch Failed:", e);
        // Fallback: return original manifest
        return manifest;
    }
};
