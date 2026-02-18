// Add this to the END of geminiService.ts (after line 571)

// REPLACEMENT for generateDeploymentReport function (lines 517-571)
export const generateDeploymentReport = async (
    agentName: string,
    role: string,
    manifest: AresTrainingManifest
): Promise<DeploymentReadinessReport> => {
    try {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("Missing API Key");
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

        const prompt = `
        IDENTITY: You are ARES, the Master Architect.
        OBJECTIVE: Generate a comprehensive deployment readiness report for ${agentName}.

        AGENT MANIFEST:
        ${JSON.stringify(manifest, null, 2)}

        DIRECTIVE:
        Analyze the training manifest and generate a deployment readiness assessment.

        CRITICAL: Your response must START with { and END with }. NO conversational text.

        OUTPUT:
        {
          "executiveSummary": "Brief summary of agent readiness",
          "masteredDomains": [
            { "domain": "Domain name", "details": "What the agent knows" }
          ],
          "guardrailManifesto": [
            { "rule": "Rule name", "constraint": "What agent cannot do" }
          ],
          "simulationResults": {
            "scenario": "Test scenario description",
            "result": "Outcome",
            "accuracy": "percentage"
          },
          "metrics": {
            "accuracy": 0-100,
            "tone": 0-100,
            "speed": 0-100,
            "toolUse": 0-100
          },
          "architectNote": "Ares's final assessment"
        }
        `;

        const result = await withRetry(() => ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ parts: [{ text: prompt }] }]
        }), 3, 6000);

        const responseText = (result as any).text || "{}";
        return cleanAndParseJSON(responseText) as DeploymentReadinessReport;
    } catch (e) {
        console.error("ARES Deployment Report Generation Failed:", e);
        // Return a fallback report
        return {
            executiveSummary: `${agentName} has completed initial training. Manual review recommended.`,
            masteredDomains: [{ domain: "Training Complete", details: "Agent manifest generated" }],
            guardrailManifesto: [{ rule: "Manual Review", constraint: "Report generation error" }],
            simulationResults: { scenario: "Report Generation", result: "Error", accuracy: "N/A" },
            metrics: { accuracy: 75, tone: 75, speed: 75, toolUse: 75 },
            architectNote: "Manual review required."
        };
    }
};
