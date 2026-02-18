// Native fetch used

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

export interface ApolloContact {
    name: string;
    first_name: string;
    last_name: string;
    title: string;
    email: string | null;
    linkedin_url: string | null;
    phone_numbers: string[];
}

/**
 * Apollo API Client
 */
export async function searchApolloPeople(companyName: string, domain?: string): Promise<ApolloContact[]> {
    if (!APOLLO_API_KEY) {
        console.warn("[Apollo Client] APOLLO_API_KEY is not set.");
        return [];
    }

    try {
        console.log(`[Apollo Client] Searching for people at: ${companyName}${domain ? ` (${domain})` : ""}`);

        const response = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "X-Api-Key": APOLLO_API_KEY
            },
            body: JSON.stringify({
                q_organization_name: companyName,
                organization_domains: domain ? [domain] : undefined,
                person_titles: ["Director", "CEO", "Founder", "Owner", "Managing Director", "Finance Director", "CFO"],
                page: 1,
                display_mode: "regular"
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Apollo Client] API error: ${response.status} - ${errorText}`);
            return [];
        }

        const data: any = await response.json();
        const people = data.people || [];

        return people.map((p: any) => ({
            name: `${p.first_name} ${p.last_name}`,
            first_name: p.first_name,
            last_name: p.last_name,
            title: p.title,
            email: p.email,
            linkedin_url: p.linkedin_url,
            phone_numbers: p.phone_numbers?.map((ph: any) => ph.sanitized_number).filter(Boolean) || []
        }));
    } catch (error) {
        console.error("[Apollo Client] Search failed:", error);
        return [];
    }
}
