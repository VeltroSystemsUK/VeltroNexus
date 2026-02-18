import { zeroBounceClient } from "../utils/zeroBounceClient";

export const emailVerificationService = {
    /**
     * Verify an email address using ZeroBounce
     * @param email The email address to verify
     * @param deepMode Whether to perform deep validation (if supported)
     */
    async verifyEmail(email: string, deepMode: boolean = false) {
        if (!email) {
            throw new Error("Email is required");
        }

        // Mock response if API key is missing (for dev/testing)
        if (!zeroBounceClient.isConfigured()) {
            console.warn("[EmailVerification] ZeroBounce not configured, returning mock valid response");
            return {
                address: email,
                status: "valid",
                sub_status: "",
                free_email: false,
                did_you_mean: null,
                account: "",
                domain: "",
                domain_age_days: "",
                smtp_provider: "",
                mx_found: "true",
                mx_record: "",
                firstname: null,
                lastname: null,
                gender: null,
                country: null,
                region: null,
                city: null,
                zipcode: null,
                processed_at: new Date().toISOString(),
                error: null
            };
        }

        return zeroBounceClient.validateEmail(email);
    },

    // Alias for compatibility if needed, though routes.ts uses verifyEmail
    async verify(email: string, deepMode: boolean = false) {
        return this.verifyEmail(email, deepMode);
    }
};
