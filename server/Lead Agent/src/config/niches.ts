/**
 * config/niches.ts
 * Target niche definitions with search query patterns
 */

export interface Niche {
    id: string;
    name: string;
    searchTerms: string[];
    dailyTarget: number;
    filters?: {
        minRating?: number;
        minReviews?: number;
    };
}

export const NICHES: Niche[] = [
    {
        id: 'engineering',
        name: 'Engineering',
        searchTerms: [
            'engineering companies',
            'mechanical engineering firms',
            'civil engineering contractors',
            'electrical engineering services',
        ],
        dailyTarget: 200,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
    },
    {
        id: 'manufacturing',
        name: 'Manufacturing',
        searchTerms: [
            'manufacturing companies',
            'industrial manufacturers',
            'precision engineering manufacturers',
            'contract manufacturers',
        ],
        dailyTarget: 200,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
    },
    {
        id: 'food_production',
        name: 'Food Production',
        searchTerms: [
            'food production companies',
            'food manufacturing',
            'food processing plants',
            'commercial bakeries',
        ],
        dailyTarget: 200,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
    },
    {
        id: 'plastics',
        name: 'Plastics',
        searchTerms: [
            'plastics manufacturers',
            'plastic injection molding companies',
            'plastic fabrication',
            'polymer processing',
        ],
        dailyTarget: 150,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
    },
    {
        id: 'recycling',
        name: 'Recycling',
        searchTerms: [
            'recycling companies',
            'waste recycling services',
            'scrap metal recycling',
            'commercial recycling',
        ],
        dailyTarget: 150,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
    },
    {
        id: 'social_care',
        name: 'Social Care',
        searchTerms: [
            'social care providers',
            'care homes',
            'domiciliary care services',
            'supported living services',
        ],
        dailyTarget: 150,
        filters: {
            minRating: 3.5,
            minReviews: 3,
        },
        // Exclude NHS in search results via post-processing
    },
];

export function getNicheById(id: string): Niche | undefined {
    return NICHES.find((n) => n.id === id);
}

export function getTotalDailyTarget(): number {
    return NICHES.reduce((sum, niche) => sum + niche.dailyTarget, 0);
}
