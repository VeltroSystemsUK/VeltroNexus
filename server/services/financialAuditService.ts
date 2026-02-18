import { companiesHouseClient } from "../utils/companiesHouseClient";

export interface FinancialMetrics {
    cashAtBank?: number;
    creditorsDueWithinOneYear?: number;
    netAssets?: number;
    periodEnd?: string;
    currency?: string;
    crisisRatio?: number; // Creditors / Cash (High is bad)
    solvencyRatio?: number; // Net Assets / Liabilities (Low is bad)
}

export class FinancialAuditService {

    /**
     * Audit Company Financials
     * Fetches latest accounts and parses key metrics
     */
    async auditFinancials(companyNumber: string): Promise<FinancialMetrics> {
        console.log(`[Financial Audit] Auditing ${companyNumber}...`);

        // 1. Get Filing History (Accounts)
        const filings = await companiesHouseClient.getFilingHistory(companyNumber, 'accounts');
        if (!filings || filings.length === 0) {
            console.log("[Financial Audit] No accounts filed.");
            return {};
        }

        // 2. Find latest "accounts" filing with available document
        const latestAccounts = filings[0]; // Assuming first is latest
        if (!latestAccounts.links || !latestAccounts.links.document_metadata) {
            console.log("[Financial Audit] No document metadata found.");
            return {};
        }

        // 3. Fetch Document Content (iXBRL/XML)
        const documentContent = await companiesHouseClient.getDocument(latestAccounts.links.document_metadata);
        if (!documentContent) {
            console.log("[Financial Audit] Failed to download document content.");
            return {};
        }

        // 4. Parse Metrics
        const metrics = this.parseIXBRL(documentContent);
        metrics.periodEnd = latestAccounts.date; // Use filing date as proxy if period not found

        // 5. Calculate Ratios
        if (metrics.cashAtBank && metrics.creditorsDueWithinOneYear) {
            // Avoid division by zero
            const cash = metrics.cashAtBank > 0 ? metrics.cashAtBank : 1;
            metrics.crisisRatio = metrics.creditorsDueWithinOneYear / cash;
        }

        return metrics;
    }

    /**
     * Parse iXBRL/XML Content
     * Extracts Cash, Creditors, Net Assets using Regex for common tags
     */
    private parseIXBRL(content: string): FinancialMetrics {
        const metrics: FinancialMetrics = {};

        // Helper to extract value by common tags/labels
        // Note: This is a simplified parser. Real iXBRL is complex. 
        // We look for patterns common in Micro-entity and Abridged accounts.

        // Cash at Bank and in Hand
        // <ix:nonNumeric name="uk-gaap:CashBankOnHand" ...>1234</ix:nonNumeric>
        // <ix:nonNumeric name="bus:CashBankOnHand" ...>1234</ix:nonNumeric>
        const cashMatch = content.match(/name="[^"]*CashBankOnHand"[^>]*>([\d,]+)</i) ||
            content.match(/Cash at bank and in hand[^<]*<[^>]*>([\d,]+)</i);
        if (cashMatch) {
            metrics.cashAtBank = this.parseNumber(cashMatch[1]);
        }

        // Creditors: amounts falling due within one year
        // name="uk-gaap:CreditorsDueWithinOneYear"
        const creditorsMatch = content.match(/name="[^"]*CreditorsDueWithinOneYear"[^>]*>([\d,]+)</i) ||
            content.match(/Creditors: amounts falling due within one year[^<]*<[^>]*>([\d,]+)</i);
        if (creditorsMatch) {
            metrics.creditorsDueWithinOneYear = this.parseNumber(creditorsMatch[1]);
        }

        // Net Assets
        // name="uk-gaap:NetAssetsLiabilities" or "uk-gaap:NetAssets"
        const netAssetsMatch = content.match(/name="[^"]*NetAssetsLiabilities"[^>]*>([\d,]+)</i) ||
            content.match(/name="[^"]*NetAssets"[^>]*>([\d,]+)</i) ||
            content.match(/Net assets[^<]*<[^>]*>([\d,]+)</i);
        if (netAssetsMatch) {
            metrics.netAssets = this.parseNumber(netAssetsMatch[1]);
        }

        // If Net Assets wasn't found, try Shareholder Funds
        if (!metrics.netAssets) {
            const fundsMatch = content.match(/name="[^"]*ShareholderFunds"[^>]*>([\d,]+)</i);
            if (fundsMatch) {
                metrics.netAssets = this.parseNumber(fundsMatch[1]);
            }
        }

        return metrics;
    }

    private parseNumber(val: string): number {
        return parseInt(val.replace(/,/g, ''), 10);
    }
}

export const financialAuditService = new FinancialAuditService();
