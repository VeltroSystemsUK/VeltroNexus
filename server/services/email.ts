import nodemailer from "nodemailer";
import crypto from "crypto";
import { mailboxForAgent } from "@shared/agentMailboxes";
import { logAgentMail, injectMailTracking } from "./agentMailLog";
import { mailIsSuppressed } from "./mailDesk";

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

function stampedContactSource(credentials: any): string | undefined {
    const value = credentials?.contactSource;
    return typeof value === "string" && value.trim() ? value : undefined;
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
    const mailLogId = crypto.randomUUID();
    const recipients = String(to || "")
      .split(/[,;]/)
      .map((addr) => addr.trim())
      .filter(Boolean);
    if (recipients.some((addr) => mailIsSuppressed(addr))) {
      console.warn(`[Email] blocked do-not-contact ${to}`);
      logAgentMail({
        id: mailLogId,
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
        touchId: credentials?.touchId,
        contactSource: stampedContactSource(credentials),
      });
      return { success: false, blocked: "suppressed", id: mailLogId };
    }

    try {
        const transporter = buildTransport(credentials || {});
        if (!transporter) {
            console.warn("No SMTP or Gmail credentials. Logging email instead.");
            console.log(`[MOCK EMAIL] From: ${fromName} <${fromAddress}>\nReply-To: ${replyTo}\nTo: ${to}\nSubject: ${subject}\nBody:\n${text}`);
            logAgentMail({
                id: mailLogId,
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
                touchId: credentials?.touchId,
                contactSource: stampedContactSource(credentials),
            });
            return { success: false, mock: true, id: mailLogId };
        }

        // Tracked HTML is what the customer actually receives, so it's also
        // what gets stored for the "exactly as the customer saw it" preview.
        const trackedHtml = html ? injectMailTracking(html, mailLogId) : html;

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            replyTo,
            to,
            subject,
            text,
            html: trackedHtml,
            attachments,
            inReplyTo: credentials?.inReplyTo,
            references: credentials?.inReplyTo,
        });
        console.log(`Email sent from ${fromAddress} to ${to}: ${info.response}`);
        logAgentMail({
            id: mailLogId,
            direction: "outbound",
            agentId: mailbox.agentId,
            agentName: mailbox.displayName,
            from: fromAddress,
            to,
            subject,
            text,
            html: trackedHtml,
            status: "sent",
            messageId: info.messageId,
            dealId: credentials?.dealId,
            prospectId: credentials?.prospectId,
            touchId: credentials?.touchId,
            contactSource: stampedContactSource(credentials),
        });
        return { success: true, messageId: info.messageId, id: mailLogId };
    } catch (error: any) {
        console.error("Error sending email:", error);
        logAgentMail({
            id: mailLogId,
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
            touchId: credentials?.touchId,
            contactSource: stampedContactSource(credentials),
        });
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
