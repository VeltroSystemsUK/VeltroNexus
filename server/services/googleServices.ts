import { google } from 'googleapis';
import { storage } from '../storage';
import { User } from '@shared/schema';

export async function getGoogleAuthClient(user: User) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.APP_URL || ''}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
        access_token: user.googleAccessToken || undefined,
        refresh_token: user.googleRefreshToken || undefined,
        expiry_date: user.googleTokenExpiry ? new Date(user.googleTokenExpiry).getTime() : undefined,
    });

    // Handle token refresh
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
            await storage.updateUser(user.id, {
                googleRefreshToken: tokens.refresh_token,
            });
        }
        if (tokens.access_token) {
            const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
            await storage.updateUser(user.id, {
                googleAccessToken: tokens.access_token,
                googleTokenExpiry: expiryDate,
            });
        }
    });

    return oauth2Client;
}

// --- Gmail Services ---
export async function listEmails(user: User) {
    const auth = await getGoogleAuthClient(user);
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
    return res.data;
}

export async function sendEmail(user: User, to: string, subject: string, body: string) {
    const auth = await getGoogleAuthClient(user);
    const gmail = google.gmail({ version: 'v1', auth });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
    });
}

// --- Drive / Docs Services ---
export async function listDriveFiles(user: User) {
    const auth = await getGoogleAuthClient(user);
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({ pageSize: 10, fields: 'files(id, name, mimeType)' });
    return res.data.files;
}

export async function uploadFileToDrive(user: User, filePath: string, fileName: string, mimeType: string) {
    const auth = await getGoogleAuthClient(user);
    const drive = google.drive({ version: 'v3', auth });
    const fs = await import('fs');

    const fileMetadata = {
        name: fileName,
        // parents: ['folderId'] // Optional: if we want to organize by folder
    };

    const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath),
    };

    const res = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
    });

    return {
        id: res.data.id,
        webViewLink: res.data.webViewLink,
        webContentLink: res.data.webContentLink
    };
}

export async function createGoogleDoc(user: User, title: string, content: string) {
    const auth = await getGoogleAuthClient(user);
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
    };

    const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
    });

    const fileId = res.data.id;
    if (!fileId) throw new Error("Failed to create Google Doc");

    // Optional: write initial content using docs.documents.batchUpdate if needed
    return { fileId, webViewLink: `https://docs.google.com/document/d/${fileId}/edit` };
}

// --- Sheets Services ---
export async function createGoogleSheet(user: User, title: string) {
    const auth = await getGoogleAuthClient(user);
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.create({
        requestBody: { properties: { title } },
    });

    return {
        spreadsheetId: res.data.spreadsheetId,
        spreadsheetUrl: res.data.spreadsheetUrl
    };
}
