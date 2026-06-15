import nodemailer from "nodemailer";
import { storage } from "../storage";
import crypto from "crypto";

/**
 * Local Email Client (Google-free)
 */

export async function createGmailDraft(
    to: string,
    subject: string,
    body: string,
    userId: string
): Promise<{ id: string; url: string }> {
    console.log(`[Local Email Draft] Creating draft to ${to}`);
    const draftId = `draft-${crypto.randomUUID()}`;
    const draftUrl = `http://localhost:5000/inbox?draft=${draftId}`;
    return {
        id: draftId,
        url: draftUrl,
    };
}

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    userId: string
): Promise<{ id: string }> {
    console.log(`[Local Email] Sending email to ${to}`);
    const messageId = `msg-${crypto.randomUUID()}`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || smtpUser,
                to,
                subject,
                text: body,
            });
            console.log(`[SMTP] Sent email to ${to}`);
        } catch (err: any) {
            console.error("[SMTP] Failed to send email via SMTP:", err.message);
        }
    } else {
        console.log(`[Email Mock] Sent outbound email to ${to} (SMTP not configured)`);
    }

    return {
        id: messageId,
    };
}
