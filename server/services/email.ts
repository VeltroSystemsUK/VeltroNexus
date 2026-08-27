import nodemailer from "nodemailer";
import { mailboxForAgent } from "@shared/agentMailboxes";
import { logAgentMail } from "./agentMailLog";

function applyVariables(content: string, variables: Record<string, any>): string {
    let finalContent = content;
    Object.keys(variables).forEach((key) => {
        finalContent = finalContent.replace(new RegExp(`{{${key}}}`, "g"), variables[key] || "");
    });
    return finalContent;
}

function asHtmlAndText(content: string): { html: string; text: string } {
    const looksHtml = /<\/?[a-z][\s\S]*>/i.test(content);
    if (looksHtml) {
        const text = content
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .trim();
        return { html: content, text };
    }
    return { html: content.replace(/\n/g, "<br>"), text: content };
}

function buildTransport(credentials: any) {
    const smtpHost = credentials.host || process.env.SMTP_HOST;
    const smtpPort = parseInt(credentials.port || process.env.SMTP_PORT || "465", 10);
    const smtpUser = credentials.user || process.env.SMTP_USER;
    const smtpPass = credentials.pass || process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
        return nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
        });
    }

    const gmailUser = credentials.user || process.env.GMAIL_USER;
    const gmailPass = credentials.pass || process.env.GMAIL_APP_PASSWORD;
    if (gmailUser && gmailPass) {
        return nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass },
        });
    }

    return null;
}

export async function sendEmail(
    credentials: any,
    to: string,
    subject: string,
    content: string,
    variables: Record<string, any> = {},
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
) {
    const finalContent = applyVariables(content, variables);
    const { html, text } = asHtmlAndText(finalContent);
    const mailbox = mailboxForAgent(credentials?.agentId);
    const fromAddress = credentials?.fromEmail || mailbox.address || process.env.SMTP_FROM;
    const fromName = credentials?.fromName || mailbox.fromName;
    const replyTo = credentials?.replyTo || mailbox.replyTo;

    try {
        const transporter = buildTransport(credentials || {});
        if (!transporter) {
            console.warn("No SMTP or Gmail credentials. Logging email instead.");
            console.log(`[MOCK EMAIL] From: ${fromName} <${fromAddress}>\nReply-To: ${replyTo}\nTo: ${to}\nSubject: ${subject}\nBody:\n${text}`);
            logAgentMail({
                direction: "outbound",
                agentId: mailbox.agentId,
                agentName: mailbox.displayName,
                from: fromAddress,
                to,
                subject,
                text,
                html,
                status: "mock",
                dealId: credentials?.dealId,
                prospectId: credentials?.prospectId,
            });
            return { success: false, mock: true };
        }

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            replyTo,
            to,
            subject,
            text,
            html,
            attachments,
        });
        console.log(`Email sent from ${fromAddress} to ${to}: ${info.response}`);
        logAgentMail({
            direction: "outbound",
            agentId: mailbox.agentId,
            agentName: mailbox.displayName,
            from: fromAddress,
            to,
            subject,
            text,
            html,
            status: "sent",
            messageId: info.messageId,
            dealId: credentials?.dealId,
            prospectId: credentials?.prospectId,
        });
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("Error sending email:", error);
        logAgentMail({
            direction: "outbound",
            agentId: mailbox.agentId,
            agentName: mailbox.displayName,
            from: fromAddress,
            to,
            subject,
            text,
            html,
            status: "failed",
            dealId: credentials?.dealId,
            prospectId: credentials?.prospectId,
        });
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
