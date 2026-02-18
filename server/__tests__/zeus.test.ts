import { describe, it, expect, vi, beforeEach } from "vitest";
import { zeusService } from "../services/zeusService";
import { storage } from "../storage";
import { enrichCompanyProfile, searchContactInfo } from "../utils/tavilyClient";
import { redactSensitiveData } from "../utils/aiGovernance";
import { generateText } from "../utils/geminiClient";
import { generateRecommendations } from "../services/lenderRecommendationEngine";

// 1. Mock all external dependencies
vi.mock("../storage", () => ({
    storage: {
        getProspect: vi.fn(),
        updateProspect: vi.fn(),
        createContact: vi.fn(),
        listProspectDocuments: vi.fn(),
        getDueDiligence: vi.fn(),
        upsertDueDiligence: vi.fn(),
        createActivity: vi.fn(),
    },
}));

vi.mock("../utils/tavilyClient", () => ({
    enrichCompanyProfile: vi.fn(),
    searchContactInfo: vi.fn(),
}));

vi.mock("../utils/aiGovernance", () => ({
    redactSensitiveData: vi.fn(),
    logAiOperation: vi.fn(),
}));

vi.mock("../utils/geminiClient", async () => {
    const actual = await vi.importActual<any>("../utils/geminiClient");
    return {
        ...actual,
        generateText: vi.fn(),
    };
});

vi.mock("../services/lenderRecommendationEngine", () => ({
    generateRecommendations: vi.fn(),
}));

describe("Zeus Service: Phase 1 Autonomous Research", () => {
    const mockUserId = "user-123";
    const mockProspectId = 999;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should perform full enrichment and officer discovery", async () => {
        // --- Setup Mocks ---

        // Mock Prospect & Company
        (storage.getProspect as any).mockResolvedValue({
            id: mockProspectId,
            userId: mockUserId,
            companyId: 101,
            company: {
                id: 101,
                companyName: "Acme Corp Ltd",
                website: "acme.com"
            }
        });

        // Mock Redaction Guard
        (redactSensitiveData as any).mockReturnValue({
            redacted: "Acme Corp Ltd", // No redaction needed here
            redactionApplied: false
        });

        // Mock Tavily Enrichment
        (enrichCompanyProfile as any).mockResolvedValue({
            businessProfile: "Acme Corp is a giant cartoon anvil manufacturer.",
            sourceCommentary: "High quality sources found.",
            sources: [{ url: "acme.com", title: "Official Site" }]
        });

        // Mock Tavily Contact Search
        (searchContactInfo as any).mockResolvedValue({
            linkedinUrls: ["linkedin.com/in/wile-e-coyote"],
            sources: [{ url: "acme.com/team", title: "Our Team", content: "Wile E. Coyote, Founder" }]
        });

        // Mock Gemini Officer Extraction
        (generateText as any).mockResolvedValue(
            'JSON: [{"name": "Wile E. Coyote", "role": "Founder"}]'
        );

        // --- Execute Zeus ---
        await zeusService.performInstantResearch(mockProspectId, mockUserId);

        // --- Assertions ---

        // Verify Redaction Guard was called
        expect(redactSensitiveData).toHaveBeenCalledWith("Acme Corp Ltd");

        // Verify Prospect Update (Research Data)
        expect(storage.updateProspect).toHaveBeenCalledWith(
            mockProspectId,
            mockUserId,
            expect.objectContaining({
                researchData: expect.objectContaining({
                    businessProfile: expect.stringContaining("anvil"),
                    zedIndex: 1
                })
            })
        );

        // Verify Contact Creation
        expect(storage.createContact).toHaveBeenCalledWith(
            expect.objectContaining({
                prospectId: mockProspectId,
                name: "Wile E. Coyote",
                role: "Founder"
            }),
            mockUserId
        );
    });

    it("should apply redaction and log findings if PII is detected", async () => {
        // Redaction Stress Test
        (storage.getProspect as any).mockResolvedValue({
            id: mockProspectId, userId: mockUserId,
            company: { companyName: "John Smith & Co" }
        });

        (redactSensitiveData as any).mockReturnValue({
            redacted: "[REDACTED_NAME] & Co",
            redactionApplied: true
        });

        (enrichCompanyProfile as any).mockResolvedValue({
            businessProfile: "REDACTED PROFILE",
            sources: []
        });

        (searchContactInfo as any).mockResolvedValue({ linkedinUrls: [], sources: [] });

        await zeusService.performInstantResearch(mockProspectId, mockUserId);

        // Verify that the REDACTED name was passed to research, not the raw one
        expect(enrichCompanyProfile).toHaveBeenCalledWith("[REDACTED_NAME] & Co", undefined);

        // Verify research data reflects redaction state
        expect(storage.updateProspect).toHaveBeenCalledWith(
            mockProspectId,
            mockUserId,
            expect.objectContaining({
                researchData: expect.objectContaining({
                    redactionApplied: true
                })
            })
        );
    });

    it("should perform document gap analysis and draft follow-up email", async () => {
        // Mock Prospect
        (storage.getProspect as any).mockResolvedValue({
            id: mockProspectId, userId: mockUserId,
            company: { companyName: "Acme Corp Ltd" }
        });

        // Mock Documents (Only Identity uploaded)
        (storage.listProspectDocuments as any).mockResolvedValue([
            { category: "identity", fileName: "passport.pdf" }
        ]);

        // Mock Gemini Email Drafting
        (generateText as any).mockResolvedValue("Dear Client, please send Bank Statements...");

        // --- Execute ---
        await zeusService.performDocumentGapAnalysis(mockProspectId, mockUserId);

        // --- Assertions ---
        expect(storage.updateProspect).toHaveBeenCalledWith(
            mockProspectId,
            mockUserId,
            expect.objectContaining({
                researchData: expect.objectContaining({
                    gapAnalysis: expect.objectContaining({
                        missingItems: expect.arrayContaining(["Bank Statements (6 months) and Trading Accounts"]),
                        status: "action_required",
                        emailDraft: expect.stringContaining("Bank Statements")
                    })
                })
            })
        );
    });

    it("should synthesize risk grade and generate SWOT analysis", async () => {
        // Mock Prospect
        (storage.getProspect as any).mockResolvedValue({
            id: mockProspectId, userId: mockUserId,
            company: { companyName: "Acme Corp Ltd" }
        });

        // Mock Due Diligence (with some financial data and adverse media)
        (storage.getDueDiligence as any).mockResolvedValue({
            data: {
                underwriting: {
                    financialAnalysis: {
                        dscr: 1.8,
                        redFlags: [],
                        netDisposableIncome: 5000
                    },
                    adverseMedia: {
                        riskLevel: "LOW"
                    }
                }
            }
        });

        // Mock Gemini Synthesis
        (generateText as any).mockResolvedValue(JSON.stringify({
            swot: {
                strengths: ["Strong DSCR"],
                weaknesses: ["None"],
                opportunities: ["Expansion"],
                threats: ["Competition"]
            },
            summary: "Strong candidate with low risk."
        }));

        // Mock Recommendations for matchmaking (called at end of synthesis)
        (generateRecommendations as any).mockResolvedValue({ recommendations: [] });

        // --- Execute ---
        await zeusService.performSmartUnderwritingEnhancement(mockProspectId, mockUserId);

        // --- Assertions ---
        expect(storage.upsertDueDiligence).toHaveBeenCalledWith(
            mockProspectId,
            mockUserId,
            expect.objectContaining({
                underwriting: expect.objectContaining({
                    riskGrade: "A", // 1.8 DSCR + Low AM Risk maps to A in calculateRiskGrade
                    swotAnalysis: expect.objectContaining({
                        strengths: expect.arrayContaining(["Strong DSCR"])
                    }),
                    adviserSummary: expect.objectContaining({
                        recommendation: "Strong candidate with low risk."
                    })
                })
            })
        );
    });

    it("should create tasks for high-fit lenders during matchmaking", async () => {
        // Mock Prospect
        (storage.getProspect as any).mockResolvedValue({
            id: mockProspectId, userId: mockUserId,
            company: { companyName: "Acme Corp Ltd" },
            researchData: {}
        });

        // Mock Recommendations (One high fit, one low fit)
        (generateRecommendations as any).mockResolvedValue({
            recommendations: [
                {
                    lender: { id: 1, institutionName: "TopBank" },
                    matchPercentage: 95,
                    reasons: ["Strong DSCR"],
                    disqualified: false
                },
                {
                    lender: { id: 2, institutionName: "LowBank" },
                    matchPercentage: 40,
                    reasons: ["Region mismatch"],
                    disqualified: false
                }
            ]
        });

        // --- Execute ---
        await zeusService.performMatchmakingAndTriggers(mockProspectId, mockUserId);

        // --- Assertions ---

        // Verify Prospect researchData update
        expect(storage.updateProspect).toHaveBeenCalledWith(
            mockProspectId,
            mockUserId,
            expect.objectContaining({
                researchData: expect.objectContaining({
                    recommendedLenders: expect.arrayContaining([
                        expect.objectContaining({ lenderName: "TopBank", matchPercentage: 95 })
                    ])
                })
            })
        );

        // Verify Activity Creation (Only for TopBank > 90%)
        expect(storage.createActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.stringContaining("High-fit lender"),
                priority: "high"
            }),
            mockUserId
        );
    });
});
