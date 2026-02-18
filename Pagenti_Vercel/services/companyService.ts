export interface CompanyProfile {
    name: string;
    industry: string;
    products: string;
    targetAudience: string;
    tone: string;
    website?: string;
    knowledgeBase?: string;
}

const STORAGE_KEY = 'pagenti_company_profile';

export const saveCompanyProfile = (profile: CompanyProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
};

export const getCompanyProfile = (): CompanyProfile | null => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Failed to parse company profile", e);
        return null;
    }
};
