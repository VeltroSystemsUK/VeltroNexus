import { User } from '@shared/schema';

export async function getGoogleAuthClient(user: User): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}

export async function listEmails(user: User): Promise<any> {
    return { messages: [] };
}

export async function sendEmail(user: User, to: string, subject: string, body: string, attachments?: any[]): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}

export async function listDriveFiles(user: User): Promise<any> {
    return { files: [] };
}

export async function uploadFileToDrive(user: User, filePath: string, fileName: string, mimeType: string): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}

export async function createGoogleDoc(user: User, title: string, content: string): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}

export async function createGoogleSheet(user: User, title: string): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}

export async function listCalendarEvents(user: User, timeMin: Date, timeMax: Date): Promise<any> {
    return { items: [] };
}

export async function createCalendarEvent(user: User, eventDetails: any): Promise<any> {
    throw new Error("Google Workspace integration is disabled in local mode.");
}
