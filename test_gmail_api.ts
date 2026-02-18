
import dotenv from "dotenv";
dotenv.config();
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "veltro-prod";

import { storage } from "./server/storage";
import { google } from "googleapis";

async function testGmailApi() {
    try {
        console.log("Starting Gmail API Test...");


        // 1. Get Super Admin
        console.log("Fetching super admin...");
        let superAdmin = await storage.getUserByEmail("shaun@veltro.co.uk");

        if (!superAdmin) {
            console.log("shaun@veltro.co.uk NOT FOUND. Checking admin@veltro.com...");
            superAdmin = await storage.getUserByEmail("admin@veltro.com");
        }

        if (!superAdmin) {
            throw new Error("No super admin found (checked shaun@veltro.co.uk and admin@veltro.com)");
        }

        console.log("Super admin found:", superAdmin.email, "ID:", superAdmin.id);

        // 2. Check Tokens
        if (!superAdmin.googleAccessToken) {
            console.log("No Google Access Token found for this user.");
            // Don't throw, just exit, as this explains the 500 error if it's the wrong user or unauthenticated
            return;
        }
        console.log("Access Token present");

        // 3. Setup Auth
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.APP_URL || ""}/api/auth/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: superAdmin.googleAccessToken,
            refresh_token: superAdmin.googleRefreshToken || undefined,
            expiry_date: superAdmin.googleTokenExpiry
                ? new Date(superAdmin.googleTokenExpiry).getTime()
                : undefined,
        });

        // 4. Test API Call
        console.log("Attempting to list messages...");
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const response = await gmail.users.messages.list({
            userId: "me",
            maxResults: 5,
        });

        console.log("API Call Successful!");
        console.log(`Found ${response.data.resultSizeEstimate} messages.`);
        if (response.data.messages && response.data.messages.length > 0) {
            console.log("First message ID:", response.data.messages[0].id);
        }

    } catch (error: any) {
        console.error("TEST FAILED:", error.message);
        if (error.response) {
            console.error("API Error Data:", error.response.data);
        }
    }
    process.exit(0);
}

testGmailApi();
