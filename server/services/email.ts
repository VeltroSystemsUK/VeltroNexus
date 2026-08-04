import nodemailer from "nodemailer";

export async function sendEmail(
    credentials: any,
    to: string,
    subject: string,
    content: string,
    variables: Record<string, any> = {},
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
) {
    // 1. Template variable replacement
    let finalContent = content;
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalContent = finalContent.replace(regex, variables[key] || '');
    });

    try {
        // Create Transporter
        // Uses Environment variables or passed credentials
        const transportConfig = {
            service: "gmail",
            auth: {
                user: credentials.user || process.env.GMAIL_USER,
                pass: credentials.pass || process.env.GMAIL_APP_PASSWORD,
            },
        };

        if (!transportConfig.auth.user || !transportConfig.auth.pass) {
            console.warn("Missing Gmail credentials (GMAIL_USER, GMAIL_APP_PASSWORD). Logging email instead.");
            console.log(`[MOCK EMAIL] To: ${to}\nSubject: ${subject}\nBody:\n${finalContent}`);
            return { success: true, mock: true };
        }

        const transporter = nodemailer.createTransport(transportConfig);

        const mailOptions = {
            from: credentials.fromEmail || transportConfig.auth.user,
            to: to,
            subject: subject,
            text: finalContent,
            html: finalContent.replace(/\n/g, "<br>"), // Simple conversion
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
        return { success: true, messageId: info.messageId };

    } catch (error: any) {
        console.error("Error sending email:", error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
