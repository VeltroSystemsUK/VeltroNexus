/**
 * Tests for the Lender Recommendation Engine
 *
 * Covers the core business logic:
 * - buildProspectProfile: postcode→region, incorporationDate→tradingYears, security types
 * - generateRecommendations: hard disqualification, scoring, sorting
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    buildProspectProfile,
    generateRecommendations,
    getTopRecommendations,
} from "../../services/lenderRecommendationEngine";
import { storage } from "../../storage";
import type { Lender, ProspectWithCompany } from "@shared/schema";

vi.mock("../../storage", () => ({
    storage: {
        getProspect: vi.fn(),
        getDueDiligence: vi.fn(),
        listLenders: vi.fn(),
    },
}));

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeLender(overrides: Partial<Lender> = {}): Lender {
    return {
        id: 1,
        userId: "user-1",
        institutionName: "Test Bank",
        contactName: null,
        email: "contact@testbank.com",
        phone: null,
        address: null,
        website: null,
        notes: null,
        lenderType: "bank",
        logoUrl: null,
        isGlobal: 0,
        productTypes: [],
        minLoanAmount: 50000,
        maxLoanAmount: 500000,
        minTermMonths: 12,
        maxTermMonths: 120,
        minLtv: null,
        maxLtv: null,
        linkedinUrl: null,
        portalUrl: null,
        typicalRateFrom: null,
        typicalRateTo: null,
        arrangementFee: null,
        sectors: [],
        regions: [],
        securityTypes: [],
        borrowerTypes: [],
        minTradingYears: 2,
        minRevenue: null,
        minDscr: null,
        acceptsStartups: 0,
        turnaroundDays: null,
        panelStatus: "market",
        accreditationStatus: null,
        fcaReference: null,
        accreditationExpiry: null,
        bdmName: null,
        bdmEmail: null,
        bdmPhone: null,
        underwriterEmail: null,
        submissionEmail: null,
        processingNotes: null,
        creditAppetite: null,
        keyStrengths: null,
        keyWeaknesses: null,
        rating: null,
        isFavourite: 0,
        introducerAgreementSigned: 0,
        lendingPolicy: null,
        insights: null,
        tier: null,
        lastContactedAt: null,
        createdAt: null,
        updatedAt: null,
        ...overrides,
    } as Lender;
}

function makeProspect(overrides: Record<string, any> = {}): ProspectWithCompany {
    const { company: companyOverrides, ...prospectOverrides } = overrides;
    return {
        id: 1,
        userId: "user-1",
        companyId: 1,
        teamId: null,
        stage: "lead",
        loanAmount: 200000,
        term: 60,
        interestRate: null,
        directorsGuarantee: 0,
        commercialProperty: 0,
        homeEquity: 0,
        propertyOther: 0,
        debenture: 0,
        parentCompanyGuarantee: 0,
        collateral: 0,
        crossCompanyGuarantee: 0,
        loanRequirementNotes: null,
        loanAllocation: [],
        priority: null,
        notes: null,
        savedAssociations: [],
        queueOrder: 0,
        referralSource: null,
        background: null,
        adviserRecommendation: null,
        adviserRecommendationSignedBy: null,
        adviserRecommendationSignedAt: null,
        loanRequirementData: null,
        researchData: null,
        createdAt: null,
        updatedAt: null,
        ...prospectOverrides,
        company: {
            id: 1,
            companyName: "Acme Corp Ltd",
            companyNumber: "12345678",
            registeredAddress: null,
            postcode: "SW1A 1AA",
            incorporationDate: new Date(
                Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000
            ).toISOString(),
            companyStatus: "active",
            companyType: "Limited",
            website: null,
            sicCode: "47710",
            sicDescription: "Retail sale of clothing",
            createdAt: null,
            ...companyOverrides,
        },
    } as ProspectWithCompany;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Lender Recommendation Engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── buildProspectProfile: region detection ─────────────────────────────

    describe("buildProspectProfile — region detection", () => {
        it("maps a London postcode to 'London'", async () => {
            // Use 'W' prefix which unambiguously maps to London
            const profile = await buildProspectProfile(
                makeProspect({ company: { postcode: "W1A 1AA" } }),
                null
            );
            expect(profile.region).toBe("London");
        });

        it("maps a North West postcode to 'North West'", async () => {
            // Use 'M' prefix (Manchester) — unambiguous first match
            const profile = await buildProspectProfile(
                makeProspect({ company: { postcode: "M1 1AE" } }),
                null
            );
            expect(profile.region).toBe("North West");
        });

        it("maps a Scotland postcode to 'Scotland'", async () => {
            // Use 'AB' prefix (Aberdeen) — first entry in the region map
            const profile = await buildProspectProfile(
                makeProspect({ company: { postcode: "AB12 3AB" } }),
                null
            );
            expect(profile.region).toBe("Scotland");
        });

        it("returns null region for null postcode", async () => {
            const profile = await buildProspectProfile(
                makeProspect({ company: { postcode: null } }),
                null
            );
            expect(profile.region).toBeNull();
        });
    });

    // ── buildProspectProfile: trading years ────────────────────────────────

    describe("buildProspectProfile — trading years", () => {
        it("calculates trading years from incorporationDate", async () => {
            const fiveYearsAgo = new Date(
                Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000
            ).toISOString();
            const profile = await buildProspectProfile(
                makeProspect({ company: { incorporationDate: fiveYearsAgo } }),
                null
            );
            expect(profile.tradingYears).toBe(5);
        });

        it("returns null tradingYears when incorporationDate is null", async () => {
            const profile = await buildProspectProfile(
                makeProspect({ company: { incorporationDate: null } }),
                null
            );
            expect(profile.tradingYears).toBeNull();
        });
    });

    // ── buildProspectProfile: security types ───────────────────────────────

    describe("buildProspectProfile — security types", () => {
        it("maps numeric boolean fields to security type strings", async () => {
            const profile = await buildProspectProfile(
                makeProspect({ directorsGuarantee: 1, commercialProperty: 1 }),
                null
            );
            expect(profile.securityTypes).toContain("Personal Guarantee");
            expect(profile.securityTypes).toContain("Commercial Property");
            expect(profile.securityTypes).toHaveLength(2);
        });

        it("returns empty array when no security types are offered", async () => {
            const profile = await buildProspectProfile(makeProspect(), null);
            expect(profile.securityTypes).toHaveLength(0);
        });
    });

    // ── generateRecommendations: hard disqualification ─────────────────────

    describe("generateRecommendations — hard disqualification", () => {
        beforeEach(() => {
            (storage.getDueDiligence as any).mockResolvedValue(null);
        });

        it("disqualifies a lender when loan amount is below minimum", async () => {
            (storage.getProspect as any).mockResolvedValue(
                makeProspect({ loanAmount: 10000 }) // below min of 50000
            );
            (storage.listLenders as any).mockResolvedValue([makeLender({ minLoanAmount: 50000 })]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(true);
            expect(result.recommendations[0].matchPercentage).toBe(0);
            expect(result.recommendations[0].disqualificationReason).toContain("below minimum");
        });

        it("disqualifies a lender when loan amount exceeds maximum", async () => {
            (storage.getProspect as any).mockResolvedValue(
                makeProspect({ loanAmount: 1000000 }) // above max of 500000
            );
            (storage.listLenders as any).mockResolvedValue([makeLender({ maxLoanAmount: 500000 })]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(true);
            expect(result.recommendations[0].disqualificationReason).toContain("exceeds maximum");
        });

        it("disqualifies a lender when DSCR is below minimum", async () => {
            (storage.getProspect as any).mockResolvedValue(makeProspect());
            (storage.getDueDiligence as any).mockResolvedValue({
                data: {
                    dscr: {
                        annualNetOperatingIncome: 100000,
                        annualDebtService: 100000, // DSCR = 1.0
                    },
                },
            });
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ minDscr: "1.25" }), // requires DSCR >= 1.25
            ]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(true);
            expect(result.recommendations[0].disqualificationReason).toContain("DSCR");
        });

        it("disqualifies a lender when trading years are insufficient", async () => {
            // Company incorporated 1 year ago
            const oneYearAgo = new Date(
                Date.now() - 1 * 365.25 * 24 * 60 * 60 * 1000
            ).toISOString();
            (storage.getProspect as any).mockResolvedValue(
                makeProspect({ company: { incorporationDate: oneYearAgo } })
            );
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ minTradingYears: 3 }), // requires 3+ years
            ]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(true);
            expect(result.recommendations[0].disqualificationReason).toContain("Trading years");
        });

        it("disqualifies startup lenders when acceptsStartups is false", async () => {
            const now = new Date().toISOString(); // incorporated today = 0 trading years
            (storage.getProspect as any).mockResolvedValue(
                makeProspect({ company: { incorporationDate: now } })
            );
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ acceptsStartups: 0 }), // does not accept startups
            ]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(true);
            expect(result.recommendations[0].disqualificationReason).toContain("startup");
        });
    });

    // ── generateRecommendations: scoring & sorting ─────────────────────────

    describe("generateRecommendations — scoring and sorting", () => {
        it("places qualified lenders before disqualified ones", async () => {
            (storage.getProspect as any).mockResolvedValue(
                makeProspect({ loanAmount: 10000 }) // below qualified bank's min but above disqualified bank's min
            );
            (storage.getDueDiligence as any).mockResolvedValue(null);
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ id: 1, institutionName: "Disqualified Bank", minLoanAmount: 50000 }),
                makeLender({ id: 2, institutionName: "Lenient Bank", minLoanAmount: 1000 }),
            ]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations[0].disqualified).toBe(false);
            expect(result.recommendations[0].lender.institutionName).toBe("Lenient Bank");
            expect(result.recommendations[1].disqualified).toBe(true);
        });

        it("favourite lender scores higher than identical non-favourite", async () => {
            (storage.getProspect as any).mockResolvedValue(makeProspect());
            (storage.getDueDiligence as any).mockResolvedValue(null);
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ id: 1, institutionName: "Normal Bank", isFavourite: 0, minLoanAmount: null, maxLoanAmount: null }),
                makeLender({ id: 2, institutionName: "Favourite Bank", isFavourite: 1, minLoanAmount: null, maxLoanAmount: null }),
            ]);

            const result = await generateRecommendations("user-1", 1);
            const favourite = result.recommendations.find(r => r.lender.institutionName === "Favourite Bank")!;
            const normal = result.recommendations.find(r => r.lender.institutionName === "Normal Bank")!;

            expect(favourite.score).toBeGreaterThan(normal.score);
            // Favourite should appear first (higher matchPercentage)
            expect(result.recommendations[0].lender.institutionName).toBe("Favourite Bank");
        });
    });

    // ── generateRecommendations: edge cases ────────────────────────────────

    describe("generateRecommendations — edge cases", () => {
        it("throws when prospect is not found", async () => {
            (storage.getProspect as any).mockResolvedValue(null);

            await expect(generateRecommendations("user-1", 999)).rejects.toThrow(
                "Prospect not found"
            );
        });

        it("returns empty recommendations when no lenders exist", async () => {
            (storage.getProspect as any).mockResolvedValue(makeProspect());
            (storage.getDueDiligence as any).mockResolvedValue(null);
            (storage.listLenders as any).mockResolvedValue([]);

            const result = await generateRecommendations("user-1", 1);
            expect(result.recommendations).toHaveLength(0);
        });
    });

    // ── getTopRecommendations ──────────────────────────────────────────────

    describe("getTopRecommendations", () => {
        it("returns only top N qualified lenders", async () => {
            (storage.getProspect as any).mockResolvedValue(makeProspect());
            (storage.getDueDiligence as any).mockResolvedValue(null);
            (storage.listLenders as any).mockResolvedValue([
                makeLender({ id: 1, institutionName: "Bank A", minLoanAmount: null, maxLoanAmount: null }),
                makeLender({ id: 2, institutionName: "Bank B", minLoanAmount: null, maxLoanAmount: null }),
                makeLender({ id: 3, institutionName: "Disqualified Bank", minLoanAmount: 9999999 }),
            ]);

            const result = await getTopRecommendations("user-1", 1, 1);
            // Should return max 1 qualified lender (not counting disqualified)
            expect(result.recommendations.filter(r => !r.disqualified)).toHaveLength(1);
        });
    });
});
