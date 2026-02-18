import { companiesHouseClient } from "../utils/companiesHouseClient";
import {
    identifyLender,
    leadScoringWeights,
    CRISIS_RATIO_THRESHOLD,
    LenderProfile
} from "../data/highRateLenders";
import { ixbrlService } from "./ixbrlService";

/**
 * Prospect Lead Scoring Service
 * 
 * 3-Layer approach to identify high-value refinancing leads
 */

export interface ChargeMarker {
    chargeNumber: string;
    createdDate: string;
    status: string;
    personEntitled: string;
    identifiedLender?: LenderProfile;
    ageMonths: number;
}

export interface FinancialMetrics {
    creditorsUnderOneYear?: number;
    cashAtBank?: number;
    crisisRatio?: number;
    netAssets?: number;
    creditorsTrend?: "increasing" | "stable" | "decreasing";
}

export interface ScoredLead {
    companyNumber: string;
    companyName: string;
    score: number;
    priority: "high" | "medium" | "low";
    chargeMarkers: ChargeMarker[];
    financialMetrics: FinancialMetrics;
    scoringBreakdown: {
        chargeScore: number;
        ageScore: number;
        creditorScore: number;
        assetScore: number;
    };
    recommendedApproach: string;
}

export class LeadScoringService {
    /**
     * Layer 2: Identify Debt Markers from Charges API
     */
    async identifyDebtMarkers(companyNumber: string): Promise<ChargeMarker[]> {
        console.log(`[Lead Scoring] Checking charges for ${companyNumber}`);

        try {
            const charges = await companiesHouseClient.getCompanyCharges(companyNumber);

            if (!charges || !charges.items) {
                return [];
            }

            const markers: ChargeMarker[] = [];

            for (const charge of charges.items) {
                // Only interested in outstanding charges
                if (charge.status !== "outstanding") {
                    continue;
                }

                // Get charge holder name
                const personEntitled = charge.persons_entitled?.[0]?.name || "";

                // Check if it's a high-rate lender
                const identifiedLender = identifyLender(personEntitled);

                // Calculate age in months
                const createdDate = new Date(charge.created_on);
                const ageMonths = Math.floor(
                    (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
                );

                // Add to markers if it's a high-rate lender or old charge
                if (identifiedLender || ageMonths >= 18) {
                    markers.push({
                        chargeNumber: charge.charge_number || "",
                        createdDate: charge.created_on,
                        status: charge.status,
                        personEntitled,
                        identifiedLender: identifiedLender || undefined,
                        ageMonths,
                    });
                }
            }

            console.log(`[Lead Scoring] Found ${markers.length} debt markers`);
            return markers;

        } catch (error) {
            console.error(`[Lead Scoring] Error fetching charges:`, error);
            return [];
        }
    }

    /**
     * Layer 3: Financial Audit (Simplified - would parse iXBRL in production)
     */
    async auditFinancialHealth(companyNumber: string): Promise<FinancialMetrics> {
        console.log(`[Lead Scoring] Auditing financials for ${companyNumber}`);

        try {
            // Parse iXBRL from filing history via Python script
            // This now uses the robust parser with fallback URL logic
            const health = await ixbrlService.auditCompany(companyNumber);

            const metrics: FinancialMetrics = {
                creditorsUnderOneYear: health.creditors || undefined,
                cashAtBank: health.cash || undefined,
                netAssets: health.netAssets || undefined,
                crisisRatio: health.crisisRatio || undefined,
                // creditorsTrend: we need historical data for this (future enhancement)
            };

            console.log(`[Lead Scoring] Audit result for ${companyNumber}: CrisisRatio=${metrics.crisisRatio}, Cash=${metrics.cashAtBank}`);
            return metrics;

        } catch (error) {
            console.error(`[Lead Scoring] Error auditing financials:`, error);
            return {};
        }
    }

    /**
     * Score a lead (0-100)
     */
    scoreLead(
        companyNumber: string,
        companyName: string,
        chargeMarkers: ChargeMarker[],
        financialMetrics: FinancialMetrics
    ): ScoredLead {
        let score = 0;
        const scoringBreakdown = {
            chargeScore: 0,
            ageScore: 0,
            creditorScore: 0,
            assetScore: 0,
        };

        // 1. Charge from non-high-street bank (+30 pts)
        const hasHighRateLender = chargeMarkers.some(m => m.identifiedLender);
        if (hasHighRateLender) {
            scoringBreakdown.chargeScore = leadScoringWeights.chargeFromNonHighStreet;
            score += leadScoringWeights.chargeFromNonHighStreet;
        }

        // 2. Charge older than 18 months (+20 pts)
        const hasOldCharge = chargeMarkers.some(m => m.ageMonths >= 18);
        if (hasOldCharge) {
            scoringBreakdown.ageScore = leadScoringWeights.chargeOlderThan18Months;
            score += leadScoringWeights.chargeOlderThan18Months;
        }

        // 3. Creditors increased (+20 pts)
        if (financialMetrics.creditorsTrend === "increasing") {
            scoringBreakdown.creditorScore = leadScoringWeights.creditorsIncreased;
            score += leadScoringWeights.creditorsIncreased;
        }

        // 4. Positive assets but low cash (+30 pts)
        if (financialMetrics.crisisRatio && financialMetrics.crisisRatio >= CRISIS_RATIO_THRESHOLD) {
            scoringBreakdown.assetScore = leadScoringWeights.positiveAssetsLowCash;
            score += leadScoringWeights.positiveAssetsLowCash;
        }

        // Determine priority
        let priority: "high" | "medium" | "low" = "low";
        if (score >= 70) priority = "high";
        else if (score >= 50) priority = "medium";

        // Generate recommended approach
        const recommendedApproach = this.generateApproach(chargeMarkers, score);

        return {
            companyNumber,
            companyName,
            score,
            priority,
            chargeMarkers,
            financialMetrics,
            scoringBreakdown,
            recommendedApproach,
        };
    }

    /**
     * Generate recommended outreach approach
     */
    private generateApproach(chargeMarkers: ChargeMarker[], score: number): string {
        if (score < 50) {
            return "Low priority - monitor for future opportunity";
        }

        const lenders = chargeMarkers
            .filter(m => m.identifiedLender)
            .map(m => m.identifiedLender!.name);

        if (lenders.length === 0) {
            return "General refinancing approach - focus on budget certainty";
        }

        if (lenders.length === 1) {
            const lender = chargeMarkers.find(m => m.identifiedLender)!.identifiedLender!;
            return `Single high-rate lender (${lender.name}): ${lender.refinancingPitch}`;
        }

        return `Debt stacking detected (${lenders.join(", ")}). Lead with consolidation savings: "You're servicing ${lenders.length} facilities—consolidate into one 5-year at 6.5%."`;
    }

    /**
     * Full lead qualification pipeline
     */
    async qualifyLead(companyNumber: string, companyName: string): Promise<ScoredLead | null> {
        console.log(`[Lead Scoring] Qualifying ${companyName} (${companyNumber})`);

        try {
            // Layer 2: Check for debt markers
            const chargeMarkers = await this.identifyDebtMarkers(companyNumber);

            // Layer 3: Financial audit
            const financialMetrics = await this.auditFinancialHealth(companyNumber);

            // Score the lead
            const scoredLead = this.scoreLead(
                companyNumber,
                companyName,
                chargeMarkers,
                financialMetrics
            );

            console.log(`[Lead Scoring] ${companyName} scored ${scoredLead.score}/100 (${scoredLead.priority} priority)`);

            return scoredLead;

        } catch (error) {
            console.error(`[Lead Scoring] Error qualifying lead:`, error);
            return null;
        }
    }
}

export const leadScoring = new LeadScoringService();
