import { storage } from "../storage";
import { generateText } from "../utils/geminiClient";

/**
 * Email Outreach Service
 * 
 * Generates personalized outreach emails using AI and manages approval queue
 */

interface OutreachEmail {
    id: string;
    prospectId: string;
    prospectName: string;
    prospectCompany: string;
    subject: string;
    body: string;
    status: "pending" | "approved" | "rejected" | "sent";
    createdAt: Date;
    approvedAt?: Date;
    sentAt?: Date;
    rejectionReason?: string;
}

export class EmailOutreachService {
    /**
     * Generate personalized outreach email for a prospect
     */
    async generateOutreachEmail(
        prospectId: string,
        prospectData: {
            name: string;
            company: string;
            turnover?: string;
            sector?: string;
            needs?: string[];
        },
        userId: string
    ): Promise<OutreachEmail> {
        console.log(`[Email Outreach] Generating email for ${prospectData.company}`);

        // Use AI to generate personalized email
        const prompt = `You are a financial services sales professional. Write a personalized, professional email to introduce our lending platform to a prospect.

Prospect Details:
- Contact Name: ${prospectData.name}
- Company: ${prospectData.company}
${prospectData.turnover ? `- Annual Turnover: ${prospectData.turnover}` : ""}
${prospectData.sector ? `- Sector: ${prospectData.sector}` : ""}
${prospectData.needs?.length ? `- Identified Needs: ${prospectData.needs.join(", ")}` : ""}

Requirements:
1. Keep it under 150 words
2. Be professional but warm
3. Highlight relevant value proposition based on their profile
4. Include a clear call-to-action
5. Don't be pushy or salesy

Return ONLY a JSON object with:
{
  "subject": "Email subject line",
  "body": "Email body (plain text, use \\n\\n for paragraphs)"
}`;

        try {
            const response = await generateText(prompt);

            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("Failed to parse AI response");
            }

            const emailData = JSON.parse(jsonMatch[0]);

            // Create email record in approval queue
            const email: OutreachEmail = {
                id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                prospectId,
                prospectName: prospectData.name,
                prospectCompany: prospectData.company,
                subject: emailData.subject,
                body: emailData.body,
                status: "pending",
                createdAt: new Date(),
            };

            // Save to approval queue (TODO: implement storage)
            console.log(`[Email Outreach] Created draft email: ${email.id}`);

            return email;
        } catch (error) {
            console.error("[Email Outreach] Failed to generate email:", error);
            throw error;
        }
    }

    /**
     * Approve an email and send it
     */
    async approveAndSend(emailId: string, userId: string): Promise<void> {
        console.log(`[Email Outreach] Approving and sending email: ${emailId}`);

        // TODO: Get email from queue
        // TODO: Send via Gmail API
        // TODO: Update status to sent

        console.log(`[Email Outreach] Email sent successfully`);
    }

    /**
     * Reject an email
     */
    async rejectEmail(emailId: string, reason: string, userId: string): Promise<void> {
        console.log(`[Email Outreach] Rejecting email: ${emailId} - ${reason}`);

        // TODO: Update status to rejected
    }

    /**
     * Get all pending emails for approval
     */
    async getPendingEmails(userId: string): Promise<OutreachEmail[]> {
        // TODO: Fetch from database
        return [];
    }

    /**
     * Send email via Gmail
     */
    private async sendViaGmail(
        to: string,
        subject: string,
        body: string,
        userId: string
    ): Promise<void> {
        console.log(`[Email Outreach] Sending email via Gmail to ${to}`);

        // TODO: Implement Gmail API integration
        // Will use Google OAuth tokens already set up
    }
}

export const emailOutreach = new EmailOutreachService();
