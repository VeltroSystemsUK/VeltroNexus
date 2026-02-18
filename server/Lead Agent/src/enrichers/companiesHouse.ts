import { Business } from '../models/business.js';
import client from '../utils/companiesHouseClient.js';

export async function enrichWithCompaniesHouse(business: Business): Promise<Partial<Business>> {
    if (!business.name) return {};

    try {
        // 1. Search for the company
        // We use the business name from Google Maps. 
        // We might want to strip common suffixes like "Ltd" to get better search matches if direct match fails, 
        // but CH search is fuzzy enough usually.
        const searchResults = await client.searchCompanies(business.name);
        if (searchResults.length === 0) return {};

        // Simple matching logic: 
        // 1. check for exact name match (ignoring case/punctuation)
        // 2. check if address snippet contains postal code or city from Google Maps address
        // For now, we'll take the first result if it looks reasonably close.
        const match = searchResults[0];

        // Basic sanity check on name similarity could go here

        const companyNumber = match.company_number;

        // 2. Get Profile (SIC, Incorporation)
        // searchResults already has some info, but Profile is safer for full data
        const profile = await client.getCompanyProfile(companyNumber);

        // 3. Get Officers
        const officers = await client.getCompanyOfficers(companyNumber);
        const activeDirector = officers.find((o: any) =>
            !o.resigned_on && o.officer_role === 'director'
        );

        let formattedContactName = null;
        if (activeDirector?.name) {
            formattedContactName = formatCHName(activeDirector.name);
        }

        // 4. Get Charges
        const charges = await client.getCompanyCharges(companyNumber);
        const activeCharges = charges.items.filter((c: any) => c.status === 'outstanding');

        // Extract unique lender names from active charges
        const lenderNames = [...new Set(activeCharges
            .flatMap((c: any) => c.persons_entitled?.map((p: any) => p.name) || [])
        )] as string[];

        return {
            companyNumber: companyNumber,
            sicCode: profile?.sic_codes?.[0] || null,
            incorporationDate: profile?.date_of_creation || null,
            contactName: formattedContactName,
            contactRole: activeDirector?.occupation || 'Director',
            hasCharges: activeCharges.length > 0,
            activeChargeCount: activeCharges.length,
            lastChargeDate: activeCharges.length > 0 ? activeCharges[0].created_on : null, // Assuming sorted descending, else sort
            lenderNames: lenderNames
        };

    } catch (error) {
        console.error(`[CH Enricher] Failed for ${business.name}:`, error);
        return {};
    }
}

// Helper to format "SURNAME, Forenames" -> "Forename Surname"
function formatCHName(chName: string): string | null {
    if (!chName) return null;

    // Check for comma format typical of CH (e.g. "SMITH, John David")
    if (chName.includes(',')) {
        const parts = chName.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            const surname = parts[0];
            const forenames = parts[1];

            // Get first forename only (ignore middle names)
            const firstForename = forenames.split(' ')[0];

            return `${toTitleCase(firstForename)} ${toTitleCase(surname)}`;
        }
    }

    // Fallback if no comma or weird format
    return toTitleCase(chName);
}

function toTitleCase(str: string) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}
