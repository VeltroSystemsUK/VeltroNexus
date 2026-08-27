import { companiesHouseClient } from "../utils/companiesHouseClient";
import {
    identifyLender,
    CRISIS_RATIO_THRESHOLD,
    LenderProfile
} from "../data/highRateLenders";
import { ixbrlService } from "./ixbrlService";
import { scoreSignals, type FiredSignal } from "@shared/salesOs";
import { harvestCompanySignals } from "./signalHarvest";

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
    signals: FiredSignal[];
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
        financialMetrics: FinancialMetrics,
        extras?: { hmrcTtp?: boolean }
    ): ScoredLead {
        const highCostCount = chargeMarkers.filter((m) => m.identifiedLender).length;
        const signals = scoreSignals({
            companyName,
            outstandingHighCostChargeCount: highCostCount,
            netAssetsNow: financialMetrics.netAssets ?? null,
            hmrcTtp: extras?.hmrcTtp,
        });

        const scoringBreakdown = {
            chargeScore: signals.signals.filter((s) => s.code === "SIG-01").reduce((sum, s) => sum + s.weight, 0),
            ageScore: chargeMarkers.some((m) => m.ageMonths >= 18) ? 10 : 0,
            creditorScore: financialMetrics.creditorsTrend === "increasing" ? 10 : 0,
            assetScore:
                financialMetrics.crisisRatio && financialMetrics.crisisRatio >= CRISIS_RATIO_THRESHOLD ? 10 : 0,
        };

        let score = signals.score + scoringBreakdown.ageScore + scoringBreakdown.creditorScore + scoringBreakdown.assetScore;
        if (signals.disqualified) score = -100;

        let priority: "high" | "medium" | "low" = "low";
        if (signals.disqualified) priority = "low";
        else if (signals.priority === "P0" || score >= 70) priority = "high";
        else if (signals.priority === "P1" || score >= 40) priority = "medium";

        const recommendedApproach = this.generateApproach(chargeMarkers, score, signals.signals);

        return {
            companyNumber,
            companyName,
            score: Math.max(-100, Math.min(100, score)),
            priority,
            chargeMarkers,
            financialMetrics,
            scoringBreakdown,
            signals: signals.signals,
            recommendedApproach,
        };
    }

    /**
     * Generate recommended outreach approach
     */
    private generateApproach(chargeMarkers: ChargeMarker[], score: number, signals: FiredSignal[] = []): string {
        if (signals.some((s) => s.code === "SIG-06") || score < 0) {
            return "Disqualified (SIG-06) — consumer / sub-£100k / non-trading profile. Do not prospect.";
        }

        const lenders = chargeMarkers
            .filter(m => m.identifiedLender)
            .map(m => m.identifiedLender!.name);

        if (signals.some((s) => s.code === "SIG-05") && lenders.length === 0) {
            return "Stream B introducer — 10-day advisory sequence. Do not pitch a facility to the practice itself.";
        }

        if (signals.some((s) => s.code === "SIG-02") && lenders.length === 0) {
            return "Stream A SME on HMRC pressure (Gazette petition / TTP proxy). Route consolidation to the CDFI panel.";
        }

        if (lenders.length === 0) {
            return "No high-cost charge on file — do not open a Stream A file.";
        }

        return `Stream A SME. Route consolidation to the CDFI panel. High-cost stack: ${lenders.join(", ")}.`;
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

            let hmrcTtp = false;
            try {
                const harvested = await harvestCompanySignals(companyNumber, companyName);
                hmrcTtp = harvested.hmrcTtp;
            } catch (error) {
                console.warn(`[Lead Scoring] Public-signal harvest failed for ${companyNumber}:`, error);
            }

            // Score the lead
            const scoredLead = this.scoreLead(
                companyNumber,
                companyName,
                chargeMarkers,
                financialMetrics,
                { hmrcTtp }
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
