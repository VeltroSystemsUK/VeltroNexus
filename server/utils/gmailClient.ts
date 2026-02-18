import { google } from "googleapis";
import { storage } from "../storage";

/**
 * Gmail API Client
 * 
 * Creates drafts in Gmail instead of auto-sending
 */

export async function createGmailDraft(
    to: string,
    subject: string,
    body: string,
    userId: string
): Promise<{ id: string; url: string }> {
    console.log(`[Gmail Client] Creating draft to ${to}`);

    try {
        // Get user's Google OAuth tokens
        const user = await storage.getUser(userId);

        if (!user?.googleAccessToken) {
            throw new Error("User not authenticated with Google");
        }

        // Initialize OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Create email in RFC 2822 format
        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
        ];

        const email = emailLines.join("\r\n");
        const encodedEmail = Buffer.from(email).toString("base64url");

        // Create draft
        const draft = await gmail.users.drafts.create({
            userId: "me",
            requestBody: {
                message: {
                    raw: encodedEmail,
                },
            },
        });

        const draftId = draft.data.id!;
        const draftUrl = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

        console.log(`[Gmail Client] Draft created: ${draftUrl}`);

        return {
            id: draftId,
            url: draftUrl,
        };
    } catch (error) {
        console.error("[Gmail Client] Failed to create draft:", error);
        throw error;
    }
}

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    userId: string
): Promise<{ id: string }> {
    console.log(`[Gmail Client] Sending email to ${to}`);

    try {
        const user = await storage.getUser(userId);

        if (!user?.googleAccessToken) {
            throw new Error("User not authenticated with Google");
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
        ];

        const email = emailLines.join("\r\n");
        const encodedEmail = Buffer.from(email).toString("base64url");

        const message = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedEmail,
            },
        });

        console.log(`[Gmail Client] Email sent: ${message.data.id}`);

        return {
            id: message.data.id!,
        };
    } catch (error) {
        console.error("[Gmail Client] Failed to send email:", error);
        throw error;
    }
}
