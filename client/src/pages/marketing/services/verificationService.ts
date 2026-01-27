import { EmailValidationResult } from "../types";
import { apiRequest } from "@/lib/queryClient";

export class VerificationService {
    async verifyEmail(
        email: string,
        deepMode: boolean,
        onLog?: (msg: string) => void
    ): Promise<EmailValidationResult> {
        try {
            const response = await apiRequest("/api/email/validate", "POST", { email, deepMode });
            const result = await response.json();

            // If we have logs from the backend, replay them to the UI
            if (onLog && result.logs) {
                for (const log of result.logs) {
                    onLog(log);
                    // Add a tiny bit of delay for visual "re-injection" effect if multiple logs
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            return result;
        } catch (error: any) {
            console.error("Verification API Error:", error);
            return {
                email,
                syntaxValid: false,
                domainValid: false,
                isFreeMail: false,
                isRoleBased: false,
                isDisposable: false,
                deliverabilityScore: 0,
                qualityGrade: 'F',
                status: 'invalid',
                explanation: "Network Error: Unable to reach verification node."
            };
        }
    }
}

export const verificationService = new VerificationService();
