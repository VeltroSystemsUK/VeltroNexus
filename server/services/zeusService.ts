import { storage } from "../storage";
import { researchCompany, searchCompanyInfo } from "../utils/geminiClient";
import { redactSensitiveData, logAiOperation } from "../utils/aiGovernance";
import { generateText, DEFAULT_GEMINI_MODEL } from "../utils/geminiClient";
import { CHECKLIST_SECTIONS } from "../../shared/checklistData";
import { calculateRiskGrade } from "../utils/geminiClient";
import { generateRecommendations } from "./lenderRecommendationEngine";

/**
 * Zeus Service
 * 
 * Orchestrates autonomous agentic tasks for the Veltro platform.
 * Currently handles Phase 1: Autonomous Research & Enrichment.
 */
export const zeusService = {
    /**
     * Performs an autonomous "Instant Research" on a new prospect.
     * Enriches the prospect profile with web intelligence and identifies key officers.
     */
    async performInstantResearch(prospectId: number, userId: string) {
        console.log(`[Zeus] Starting autonomous research for prospect: ${prospectId}`);

        try {
            // 1. Fetch prospect and company data
            const prospect = await storage.getProspect(prospectId, userId);
            if (!prospect) {
                console.warn(`[Zeus] Prospect ${prospectId} not found. Aborting research.`);
                return;
            }

            const { company } = prospect;
            if (!company) {
                console.warn(`[Zeus] No company associated with prospect ${prospectId}. Aborting.`);
                return;
            }

            // 2. Redaction Guard (Stress Test 1)
            // We redact company names if they look like personal names, but mainly we use this 
            // to ensure we log that the guard was active.
            const { redacted: safeCompanyName, redactionApplied } = redactSensitiveData(company.companyName);

            // 3. Perform Deep Research via Gemini
            console.log(`[Zeus] Enriched research for: ${safeCompanyName}`);
            const enrichment = await researchCompany(safeCompanyName, company.website || undefined);

            // 4. Update Prospect Research Data
            await storage.updateProspect(prospectId, userId, {
                researchData: {
                    businessProfile: enrichment.businessProfile,
                    sourceCommentary: enrichment.sourceCommentary,
                    sources: enrichment.sources,
                    zedIndex: 1, // Zeus processed version 1
                    redactionApplied,
                    lastHeuristicUpdate: new Date().toISOString()
                }
            });

            // 5. Officer Discovery & Contact Auto-Population
            // Use the business profile or name to find key individuals
            const contactInfo = await searchCompanyInfo(safeCompanyName);

            if (contactInfo.linkedinUrls.length > 0 || contactInfo.contacts.length > 0) {
                console.log(`[Zeus] Discovered potential contact signals.`);

                // Use AI to synthesize names from found URLs/Sources if they aren't explicit
                const officerPrompt = `
            Analyze these search results for ${safeCompanyName} and extract the names and roles of key directors or decision makers.
            DATA:
            ${JSON.stringify(contactInfo.sources.slice(0, 5))}
            
            OUTPUT: A JSON array of { name: string, role: string, linkedinUrl?: string }
          `;

                try {
                    const aiRaw = await generateText(officerPrompt, DEFAULT_GEMINI_MODEL);
                    const match = aiRaw.match(/\[[\s\S]*\]/);
                    if (match) {
                        const officers = JSON.parse(match[0]);

                        for (const officer of officers) {
                            if (officer.name && officer.name.length > 2) {
                                // Check if contact already exists
                                // For now, we'll just create them as secondary contacts
                                await storage.createContact({
                                    prospectId,
                                    name: officer.name,
                                    role: officer.role || "Director",
                                    notes: `Autodiscovered by Zeus at ${new Date().toLocaleDateString()}`,
                                    isPrimary: 0
                                }, userId);
                            }
                        }
                    }
                } catch (aiErr) {
                    console.error("[Zeus] Failed to synthesize officer list:", aiErr);
                }
            }

            // 6. Audit Logging
            logAiOperation({
                userId,
                operation: "zeus_instant_research",
                prospectId,
                dataType: "web_search",
                timestamp: new Date(),
                dataSizeBytes: 0, // Metadata only
                consentGiven: true,
                redactionApplied
            });

            console.log(`[Zeus] Research complete for prospect: ${prospectId}`);

        } catch (error) {
            console.error(`[Zeus] Autonomous research failed for prospect ${prospectId}:`, error);
        }
    },

    /**
     * Performs an autonomous "Document Gap Analysis".
     * Audits prospect documents against the checklist and drafts follow-up requests.
     */
    async performDocumentGapAnalysis(prospectId: number, userId: string) {
        console.log(`[Zeus] Starting document gap analysis for prospect: ${prospectId}`);

        try {
            // 1. Fetch prospect and their documents
            const prospect = await storage.getProspect(prospectId, userId);
            if (!prospect) return;

            const documents = await storage.listProspectDocuments(prospectId, userId);

            // 2. Map existing document categories
            const uploadedCategories = new Set(documents.map(d => d.category));

            // 3. Identify Gaps
            // We focus on core categories: financial, legal, identity, property
            const gaps: string[] = [];
            const auditReport: any = {
                timestamp: new Date().toISOString(),
                checks: []
            };

            for (const section of CHECKLIST_SECTIONS) {
                // Focus on sections that traditionally require documents
                if (["kyc-identity", "financial-documents", "company-business-info", "application-documentation"].includes(section.id)) {
                    for (const item of section.items) {
                        auditReport.checks.push({
                            id: item.id,
                            description: item.description,
                            status: "pending" // Default
                        });
                    }
                }
            }

            // Simple heuristic mapping for the audit
            // In a real scenario, we'd use Gemini to classify the filenames/content more deeply
            const missingSummary: string[] = [];
            if (!uploadedCategories.has("identity")) missingSummary.push("Photo ID / Passport");
            if (!uploadedCategories.has("financial")) missingSummary.push("Bank Statements (6 months) and Trading Accounts");
            if (!uploadedCategories.has("legal")) missingSummary.push("Business Plan or CVs");

            // 4. Draft Follow-up using Gemini
            const draftPrompt = `
                Zeus AI Auditor. 
                PROSPECT: ${prospect.company.companyName}
                MISSING DOCUMENTS: ${missingSummary.join(", ")}
                
                ACTION: Draft a professional, proactive email from the advisory team to the client requesting these specific missing items. 
                Keep it concise and supportive.
            `;

            const emailDraft = await generateText(draftPrompt, DEFAULT_GEMINI_MODEL);

            // 5. Update Prospect Research Data with Gap Analysis
            const existingResearch = (prospect as any).researchData || {};
            await storage.updateProspect(prospectId, userId, {
                researchData: {
                    ...existingResearch,
                    gapAnalysis: {
                        lastAuditAt: new Date().toISOString(),
                        missingItems: missingSummary,
                        emailDraft,
                        status: missingSummary.length > 0 ? "action_required" : "complete"
                    }
                }
            });

            // 6. Log AI Operation
            logAiOperation({
                userId,
                operation: "zeus_gap_analysis",
                prospectId,
                dataType: "document_audit",
                timestamp: new Date(),
                dataSizeBytes: 0,
                consentGiven: true,
                redactionApplied: false
            });

            console.log(`[Zeus] Gap analysis complete for prospect: ${prospectId}. Gaps found: ${missingSummary.length}`);

        } catch (error) {
            console.error(`[Zeus] Document gap analysis failed for prospect ${prospectId}:`, error);
        }
    },

    /**
     * Performs an autonomous "Smart Underwriting Enhancement".
     * Synthesizes financial analysis, adverse media, and risk scoring into a unified narrative.
     */
    async performSmartUnderwritingEnhancement(prospectId: number, userId: string) {
        console.log(`[Zeus] Starting smart underwriting enhancement for prospect: ${prospectId}`);

        try {
            // 1. Fetch data
            const prospect = await storage.getProspect(prospectId, userId);
            const dueDiligence = await storage.getDueDiligence(prospectId, userId);
            if (!prospect || !dueDiligence) return;

            const underwriting = (dueDiligence.data as any).underwriting || {};
            const financials = underwriting.financialAnalysis || {};
            const adverseMedia = underwriting.adverseMedia || {};

            // 2. Synthesize Risk Grade
            // Combine metrics from bank analytics and background checks
            const dscr = financials.dscr || 0;
            const redFlagsCount = financials.redFlags?.length || 0;
            const netDisposable = financials.netDisposableIncome || 0;
            const amRisk = adverseMedia.riskLevel || "LOW";

            const synthesizedRiskGrade = calculateRiskGrade(
                dscr,
                redFlagsCount,
                netDisposable,
                true, // Scenario is active
                amRisk
            );

            console.log(`[Zeus] Synthesized Risk Grade: ${synthesizedRiskGrade} (DSCR: ${dscr}, AM Risk: ${amRisk})`);

            // 3. Generate SWOT & Executive Summary via Gemini
            const synthesisPrompt = `
                You are Zeus, the Lead AI Underwriter for Veltro. 
                Perform a SWOT analysis and Executive Summary for: ${prospect.company.companyName}
                
                FINANCIAL DATA:
                - DSCR: ${dscr.toFixed(2)}
                - Monthly Surplus: £${netDisposable.toFixed(2)}
                - Red Flags Found: ${redFlagsCount}
                
                ADVERSE MEDIA RISK: ${amRisk}
                
                ACTION: 
                1. Strengths, Weaknesses, Opportunities, Threats (SWOT).
                2. A 3-sentence "Adviser Summary" suitable for lender submission.
                
                OUTPUT: JSON object with keys { swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }, summary: string }
            `;

            try {
                const aiRaw = await generateText(synthesisPrompt, DEFAULT_GEMINI_MODEL);
                const match = aiRaw.match(/\{[\s\S]*\}/);
                if (match) {
                    const synthesis = JSON.parse(match[0]);

                    // 4. Update Underwriting Data
                    const updatedUnderwriting = {
                        ...underwriting,
                        swotAnalysis: synthesis.swot,
                        swotAnalyzedAt: new Date().toISOString(),
                        riskGrade: synthesizedRiskGrade,
                        adviserSummary: {
                            ...(underwriting.adviserSummary || {}),
                            recommendation: synthesis.summary,
                            aiSynthesizedAt: new Date().toISOString()
                        }
                    };

                    await storage.upsertDueDiligence(prospectId, userId, {
                        ...dueDiligence.data,
                        underwriting: updatedUnderwriting
                    } as any);

                    // 5. Log AI Operation
                    logAiOperation({
                        userId,
                        operation: "zeus_smart_underwriting",
                        prospectId,
                        dataType: "underwriting_synthesis",
                        timestamp: new Date(),
                        dataSizeBytes: 0,
                        consentGiven: true,
                        redactionApplied: false
                    });

                    console.log(`[Zeus] Underwriting enhancement complete for prospect: ${prospectId}`);

                    // 6. Trigger Matchmaking & Follow-ups
                    await this.performMatchmakingAndTriggers(prospectId, userId);
                }
            } catch (aiErr) {
                console.error("[Zeus] AI synthesis failed during underwriting enhancement:", aiErr);
            }

        } catch (error) {
            console.error(`[Zeus] Smart underwriting enhancement failed for prospect ${prospectId}:`, error);
        }
    },

    /**
     * Performs autonomous matchmaking and creates follow-up triggers.
     */
    async performMatchmakingAndTriggers(prospectId: number, userId: string) {
        console.log(`[Zeus] Starting matchmaking for prospect: ${prospectId}`);

        try {
            // 1. Get Recommendations
            const recommendations = await generateRecommendations(userId, prospectId);
            const topMatches = recommendations.recommendations.filter(m => !m.disqualified).slice(0, 3);

            if (topMatches.length === 0) return;

            // 2. Update Prospect with Recommended Lenders
            const prospect = await storage.getProspect(prospectId, userId);
            if (!prospect) return;

            const researchData = prospect.researchData || {};
            await storage.updateProspect(prospectId, userId, {
                researchData: {
                    ...researchData,
                    recommendedLenders: topMatches.map(m => ({
                        lenderId: m.lender.id,
                        lenderName: m.lender.institutionName,
                        matchPercentage: m.matchPercentage,
                        reasons: m.reasons.slice(0, 2)
                    }))
                }
            });

            // 3. Automated Follow-up Triggers & Draft Generation
            for (const match of topMatches) {
                // Trigger: High Fit Alert (>90%)
                if (match.matchPercentage >= 90) {
                    console.log(`[Zeus Trigger] High-fit lender identified: ${match.lender.institutionName} (${match.matchPercentage}%)`);

                    // Generate Submission Draft
                    const draftPrompt = `
                        You are Zeus. Draft a formal Lender Submission Email for this deal.
                        LENDER: ${match.lender.institutionName} (Contact: Lending Team)
                        PROSPECT: ${prospect.company.companyName}
                        KEY METRICS: Match ${match.matchPercentage}%, Reasons: ${match.reasons.join(", ")}
                        
                        CONTENT:
                        - Subject Line: New Deal Submission: ${prospect.company.companyName}
                        - Introduction: Briefly introduce the business.
                        - Deal Highlights: 3 key bullet points on why this fits their criteria.
                        - Call to Action: Request review of attached credit pack.
                        
                        OUTPUT: A clean email body string.
                    `;
                    const emailBody = await generateText(draftPrompt, DEFAULT_GEMINI_MODEL);

                    // Create Actionable Task with Draft
                    await storage.createActivity({
                        prospectId,
                        title: `Zeus: Ready to Submit to ${match.lender.institutionName}`,
                        description: `High Fit Match (${match.matchPercentage}%). Submission email drafted. Review and click to send.\n\nTYPE: proposal_draft\n\nDRAFT CONTENT:\n${emailBody}`,
                        activityType: "task",
                        priority: "high",
                        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
                        completed: 0
                    }, userId);
                }
            }

            // 4. Update Due Diligence with Suggestion
            const dueDiligence = await storage.getDueDiligence(prospectId, userId);
            if (dueDiligence) {
                const underwriting = (dueDiligence.data as any).underwriting || {};
                const riskGrade = underwriting.riskGrade || "C";

                if (["A", "B"].includes(riskGrade) && topMatches.length >= 2) {
                    const updatedUnderwriting = {
                        ...underwriting,
                        adviserSummary: {
                            ...(underwriting.adviserSummary || {}),
                            zeusSuggestion: `Zeus identifies this as a high-quality ${riskGrade}-grade deal. Recommends immediate submission to ${topMatches[0].lender.institutionName} and ${topMatches[1].lender.institutionName}.`
                        }
                    };

                    await storage.upsertDueDiligence(prospectId, userId, {
                        ...dueDiligence.data,
                        underwriting: updatedUnderwriting
                    } as any);
                }
            }

            console.log(`[Zeus] Matchmaking and triggers complete for prospect: ${prospectId}`);

        } catch (error) {
            console.error(`[Zeus] Matchmaking failed for prospect ${prospectId}:`, error);
        }
    }
};
