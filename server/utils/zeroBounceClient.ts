/**
 * ZeroBounce Email Validation API Client
 * https://www.zerobounce.net/docs/email-validation-api-quickstart/
 */

export interface ZeroBounceResponse {
    address: string;
    status: string; // "valid", "invalid", "catch-all", "unknown", "spamtrap", "abuse", "do_not_mail"
    sub_status: string;
    free_email: boolean;
    did_you_mean: string | null;
    account: string;
    domain: string;
    domain_age_days: string;
    smtp_provider: string;
    mx_found: string; // "true" or "false"
    mx_record: string;
    firstname: string | null;
    lastname: string | null;
    gender: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    zipcode: string | null;
    processed_at: string;
    error: string | null;
}

export class ZeroBounceClient {
    private apiKey: string;
    private baseUrl = 'https://api.zerobounce.net/v2';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.ZEROBOUNCE_API_KEY || '';
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async validateEmail(email: string): Promise<ZeroBounceResponse | null> {
        if (!this.apiKey) {
            console.warn('[ZeroBounce] API key not configured');
            return null;
        }

        try {
            const url = `${this.baseUrl}/validate?api_key=${this.apiKey}&email=${encodeURIComponent(email)}&ip_address=`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('[ZeroBounce] API request failed:', response.status);
                return null;
            }

            const data = await response.json() as ZeroBounceResponse;

            if (data.error) {
                console.error('[ZeroBounce] API error:', data.error);
                return null;
            }

            return data;
        } catch (error: any) {
            console.error('[ZeroBounce] Request failed:', error.message);
            return null;
        }
    }

    /**
     * Map ZeroBounce status to our internal scoring system
     */
    mapToQualityGrade(zbResponse: ZeroBounceResponse): {
        deliverabilityScore: number;
        qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
        status: 'valid' | 'risky' | 'invalid';
        explanation: string;
    } {
        let score = 100;
        let explanation = '';

        // Primary status mapping
        switch (zbResponse.status.toLowerCase()) {
            case 'valid':
                score = 100;
                explanation = 'ZeroBounce: Email verified as deliverable.';
                break;
            case 'catch-all':
                score = 70;
                explanation = 'ZeroBounce: Catch-all domain - cannot verify individual mailbox.';
                break;
            case 'unknown':
                score = 50;
                explanation = 'ZeroBounce: Unable to verify - mail server did not respond.';
                break;
            case 'spamtrap':
            case 'abuse':
            case 'do_not_mail':
                score = 0;
                explanation = `ZeroBounce: ${zbResponse.status} - Do not send emails to this address.`;
                break;
            case 'invalid':
            default:
                score = 0;
                explanation = 'ZeroBounce: Email address is invalid or does not exist.';
                break;
        }

        // Apply free email penalty
        if (zbResponse.free_email && score > 0) {
            score -= 15;
            explanation += ' Free email provider detected.';
        }

        // Apply MX record check
        if (zbResponse.mx_found === 'false') {
            score = Math.min(score, 20);
            explanation += ' No MX records found.';
        }

        // Determine grade
        let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
        if (score >= 90) qualityGrade = 'A';
        else if (score >= 75) qualityGrade = 'B';
        else if (score >= 55) qualityGrade = 'C';
        else if (score >= 35) qualityGrade = 'D';

        const status = score > 70 ? 'valid' : score > 30 ? 'risky' : 'invalid';

        return {
            deliverabilityScore: Math.max(0, score),
            qualityGrade,
            status,
            explanation: explanation.trim()
        };
    }
}

export const zeroBounceClient = new ZeroBounceClient();
