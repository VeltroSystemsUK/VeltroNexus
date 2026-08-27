
const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const BASE_URL = 'https://api.company-information.service.gov.uk';

// Shared auth/fetch helper — every CH call site was reimplementing this Basic Auth
// construction inline. Callers keep their own status-code/error-shaping logic;
// this just removes the duplicated boilerplate around it.
export function chAuthHeader(): string | null {
    const key = COMPANIES_HOUSE_API_KEY?.trim();
    if (!key) return null;
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export async function chFetch(path: string): Promise<Response> {
    const auth = chAuthHeader();
    if (!auth) {
        throw new Error('COMPANIES_HOUSE_API_KEY not configured');
    }
    return fetch(`${BASE_URL}${path}`, { headers: { Authorization: auth } });
}

export interface CompaniesHouseSearchResult {
    company_name: string;
    company_number: string;
    company_status: string;
    company_type: string;
    date_of_creation?: string;
    address_snippet?: string;
    snippet?: string;
}

export async function searchCompanies(query: string, items_per_page: number = 10): Promise<CompaniesHouseSearchResult[]> {
    if (!COMPANIES_HOUSE_API_KEY) {
        console.warn("COMPANIES_HOUSE_API_KEY is not set. Returning empty results.");
        return [];
    }

    // Basic Auth with API Key as username and empty password
    const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

    try {
        const response = await fetch(`${BASE_URL}/search/companies?q=${encodeURIComponent(query)}&items_per_page=${items_per_page}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Companies House API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return (data.items || []).map((item: any) => ({
            company_name: item.title,
            company_number: item.company_number,
            company_status: item.company_status,
            company_type: item.company_type,
            date_of_creation: item.date_of_creation,
            address_snippet: item.address_snippet,
            snippet: item.snippet,
        }));

    } catch (error) {
        console.error("Companies House Search Failed:", error);
        throw error;
    }
}

export const companiesHouseClient = {
    searchCompanies,

    async getCompanyProfile(companyNumber: string): Promise<any> {
        if (!COMPANIES_HOUSE_API_KEY) return null;
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        try {
            const response = await fetch(`${BASE_URL}/company/${companyNumber}`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error(`Error fetching profile for ${companyNumber}:`, e);
            return null;
        }
    },

    async getCompanyCharges(companyNumber: string): Promise<any> {
        if (!COMPANIES_HOUSE_API_KEY) return { items: [] };
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        try {
            const response = await fetch(`${BASE_URL}/company/${companyNumber}/charges`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            if (response.status === 404) return { items: [] };
            if (!response.ok) throw new Error(`API Error ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error(`Error fetching charges for ${companyNumber}:`, e);
            return { items: [] };
        }
    },

    async getFilingHistory(companyNumber: string, category?: string): Promise<any> {
        if (!COMPANIES_HOUSE_API_KEY) return [];
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        try {
            let url = `${BASE_URL}/company/${companyNumber}/filing-history`;
            if (category) {
                url += `?category=${category}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (!response.ok) return [];
            const data = await response.json();
            return data.items || [];
        } catch (e) {
            return [];
        }
    },

    async getCompanyInsolvency(companyNumber: string): Promise<any> {
        if (!COMPANIES_HOUSE_API_KEY) return null;
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString("base64");
        try {
            const response = await fetch(`${BASE_URL}/company/${companyNumber}/insolvency`, {
                headers: { Authorization: `Basic ${auth}` },
            });
            if (response.status === 404) return null;
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error(`Error fetching insolvency for ${companyNumber}:`, e);
            return null;
        }
    },

    async getCompanyOfficers(companyNumber: string): Promise<any> {
        if (!COMPANIES_HOUSE_API_KEY) return [];
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        try {
            const response = await fetch(`${BASE_URL}/company/${companyNumber}/officers`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (!response.ok) return [];
            const data = await response.json();
            return data.items || [];
        } catch (e) {
            console.error(`Error fetching officers for ${companyNumber}:`, e);
            return [];
        }
    },

    async getDocument(documentMetadataUrl: string): Promise<string | null> {
        if (!COMPANIES_HOUSE_API_KEY) return null;
        // The metadata URL is usually 'https://frontend-doc-api.company-information.service.gov.uk/document/...'
        // But we need to hit the document API, often replacing the host or using the provided link.
        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        try {
            // First, get the metadata to find the content link
            const metaResponse = await fetch(documentMetadataUrl, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (!metaResponse.ok) return null;
            const metadata = await metaResponse.json();

            // The content link is usually in links.document_content
            const contentUrl = metadata.links?.document_content;
            if (!contentUrl) return null;

            // Fetch the actual content (usually iXBRL/XML or PDF)
            // Companies House API sometimes redirects, and fetch handles this or we might need followRedirect.
            const contentResponse = await fetch(contentUrl, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/xhtml+xml,application/xml,application/pdf'
                }
            });

            if (!contentResponse.ok) return null;
            return await contentResponse.text();
        } catch (e) {
            console.error(`Error fetching document from ${documentMetadataUrl}:`, e);
            return null;
        }
    }
};

export default companiesHouseClient;
