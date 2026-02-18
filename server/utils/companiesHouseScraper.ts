import { HIGH_RATE_LENDERS, isHighRateLender } from "../data/highRateCommercialLenders";

/**
 * Interface for Companies House Company Profile
 */
interface CompanyProfile {
    company_name: string;
    company_number: string;
    date_of_creation: string;
    sic_codes?: string[];
    registered_office_address?: any;
    company_status: string;
    type: string;
}

/**
 * Interface for Companies House Charge
 */
interface Charge {
    id: string;
    created_on: string;
    delivered_on?: string;
    status: string; // 'outstanding', 'fully-satisfied', etc.
    persons_entitled: { name: string }[];
    charge_code?: string;
}

/**
 * Interface for Scraped Prospect
 */
export interface Prospect {
    companyName: string;
    companyNumber: string;
    sicCodes: string[];
    incorporationDate: string;
    debtMarkers: {
        lender: string;
        createdOn: string;
        category: string;
        displacementAngle: string;
    }[];
    riskScore: number; // 0-100
}

// API Configuration
const BASE_URL = "https://api.company-information.service.gov.uk";
// You should ensure COMPANIES_HOUSE_API_KEY is in your .env

/**
 * Service to scrape Companies House for high-rate refinancing leads
 */
export const companiesHouseScraper = {

    /**
     * Search for companies matching specific criteria (SIC, Age)
     */
    async searchProspects(apiKey: string, sicCode: string = "41202", incFrom: string = "2018-01-01", incTo: string = "2022-12-31"): Promise<CompanyProfile[]> {
        const endpoint = `${BASE_URL}/advanced-search/companies`;
        const params = new URLSearchParams({
            sic_codes: sicCode,
            incorporated_from: incFrom,
            incorporated_to: incTo,
            company_status: "active",
            size: "50"
        });

        try {
            const response = await fetch(`${endpoint}?${params.toString()}`, {
                headers: {
                    Authorization: `Basic ${btoa(apiKey + ":")}`
                }
            });

            if (!response.ok) {
                throw new Error(`Companies House API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error("Failed to search prospects:", error);
            return [];
        }
    },

    /**
     * Check a company's charges for high-interest debt markers
     */
    async checkHighInterestDebt(apiKey: string, companyNumber: string): Promise<Prospect | null> {
        const endpoint = `${BASE_URL}/company/${companyNumber}/charges`;

        try {
            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Basic ${btoa(apiKey + ":")}`
                }
            });

            if (response.status === 404) return null; // No charges found
            if (!response.ok) return null;

            const data = await response.json();
            const charges: Charge[] = data.items || [];
            const debtMarkers: Prospect['debtMarkers'] = [];

            for (const charge of charges) {
                if (charge.status === 'outstanding') {
                    for (const person of charge.persons_entitled || []) {
                        const highRateLender = isHighRateLender(person.name);

                        if (highRateLender) {
                            debtMarkers.push({
                                lender: person.name,
                                createdOn: charge.created_on,
                                category: highRateLender.category,
                                displacementAngle: highRateLender.displacementAngle
                            });
                        }
                    }
                }
            }

            if (debtMarkers.length > 0) {
                // Fetch company details to complete the prospect object
                // For efficiency, you might have this from the search step, but this function is standalone
                const profileResp = await fetch(`${BASE_URL}/company/${companyNumber}`, {
                    headers: { Authorization: `Basic ${btoa(apiKey + ":")}` }
                });
                const profile = await profileResp.json();

                return {
                    companyName: profile.company_name,
                    companyNumber: profile.company_number,
                    sicCodes: profile.sic_codes || [],
                    incorporationDate: profile.date_of_creation,
                    debtMarkers,
                    riskScore: this.calculateRiskScore(debtMarkers)
                };
            }

            return null;
        } catch (error) {
            console.error(`Failed to check charges for ${companyNumber}:`, error);
            return null;
        }
    },

    /**
     * Calculate a lead score based on debt markers and logic
     */
    calculateRiskScore(markers: Prospect['debtMarkers']): number {
        let score = 0;

        // Base score for having any high-rate debt
        if (markers.length > 0) score += 50;

        // Debt Stacking (multiple lenders)
        if (markers.length > 1) score += 20;

        // Maturity Cliff (Charges from 2023-2024 are entering maturity/rollover phase in 2026)
        const hasMaturityCliff = markers.some(m => {
            const year = new Date(m.createdOn).getFullYear();
            return year === 2023 || year === 2024;
        });
        if (hasMaturityCliff) score += 20;

        // Specific Lender weighting (e.g. MCA is very high pain)
        const hasMCA = markers.some(m => m.category === 'mca');
        if (hasMCA) score += 10;

        return Math.min(score, 100);
    }
};
