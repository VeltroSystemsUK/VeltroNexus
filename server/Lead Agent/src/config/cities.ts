/**
 * config/cities.ts
 * UK cities for geographic coverage
 */

export interface City {
    name: string;
    priority: number; // 1 = highest priority
    coordinates?: {
        lat: number;
        lng: number;
    };
}

export const UK_CITIES: City[] = [
    // Tier 1 - Major cities (Priority 1)
    { name: 'London', priority: 1, coordinates: { lat: 51.5074, lng: -0.1278 } },
    { name: 'Birmingham', priority: 1, coordinates: { lat: 52.4862, lng: -1.8904 } },
    { name: 'Manchester', priority: 1, coordinates: { lat: 53.4808, lng: -2.2426 } },
    { name: 'Leeds', priority: 1, coordinates: { lat: 53.8008, lng: -1.5491 } },

    // Tier 2 - Large cities (Priority 2)
    { name: 'Glasgow', priority: 2, coordinates: { lat: 55.8642, lng: -4.2518 } },
    { name: 'Edinburgh', priority: 2, coordinates: { lat: 55.9533, lng: -3.1883 } },
    { name: 'Liverpool', priority: 2, coordinates: { lat: 53.4084, lng: -2.9916 } },
    { name: 'Newcastle', priority: 2, coordinates: { lat: 54.9783, lng: -1.6178 } },

    // Tier 3 - Medium cities (Priority 3)
    { name: 'Sheffield', priority: 3, coordinates: { lat: 53.3811, lng: -1.4701 } },
    { name: 'Bristol', priority: 3, coordinates: { lat: 51.4545, lng: -2.5879 } },
    { name: 'Cardiff', priority: 3, coordinates: { lat: 51.4816, lng: -3.1791 } },
    { name: 'Belfast', priority: 3, coordinates: { lat: 54.5973, lng: -5.9301 } },

    // Tier 4 - Smaller cities (Priority 4)
    { name: 'Nottingham', priority: 4, coordinates: { lat: 52.9548, lng: -1.1581 } },
    { name: 'Leicester', priority: 4, coordinates: { lat: 52.6369, lng: -1.1398 } },
    { name: 'Coventry', priority: 4, coordinates: { lat: 52.4068, lng: -1.5197 } },
    { name: 'Bradford', priority: 4, coordinates: { lat: 53.7960, lng: -1.7594 } },

    // Tier 5 - Additional coverage (Priority 5)
    { name: 'Portsmouth', priority: 5, coordinates: { lat: 50.8198, lng: -1.0880 } },
    { name: 'Southampton', priority: 5, coordinates: { lat: 50.9097, lng: -1.4044 } },
    { name: 'Reading', priority: 5, coordinates: { lat: 51.4543, lng: -0.9781 } },
    { name: 'Plymouth', priority: 5, coordinates: { lat: 50.3755, lng: -4.1427 } },
];

/**
 * Get cities by priority level
 */
export function getCitiesByPriority(priority: number): City[] {
    return UK_CITIES.filter((city) => city.priority === priority);
}

/**
 * Get cities for a day's rotation
 * Returns 4 cities cycling through all tiers
 */
export function getDailyCities(dayOffset: number = 0): City[] {
    const citiesPerDay = 4;
    const startIndex = (dayOffset * citiesPerDay) % UK_CITIES.length;
    const cities: City[] = [];

    for (let i = 0; i < citiesPerDay; i++) {
        const index = (startIndex + i) % UK_CITIES.length;
        cities.push(UK_CITIES[index]);
    }

    return cities;
}

/**
 * Build search query with city
 */
export function buildCityQuery(searchTerm: string, city: City): string {
    return `${searchTerm} in ${city.name}, UK`;
}
