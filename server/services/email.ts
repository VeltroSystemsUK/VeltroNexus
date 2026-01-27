
export async function sendEmail(
    credentials: any,
    to: string,
    subject: string,
    content: string,
    variables: Record<string, any> = {}
) {
    if (!credentials || !credentials.apiKey) {
        throw new Error("Missing email credentials");
    }

    // 1. Template variable replacement
    let finalContent = content;
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalContent = finalContent.replace(regex, variables[key] || '');
    });

    // 2. Send via SendGrid
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${credentials.apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: credentials.fromEmail || "noreply@veltro.com", name: credentials.fromName || "Veltro User" },
            subject: subject,
            content: [{ type: "text/plain", value: finalContent }] // simple text for now
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("SendGrid Error:", response.status, errorText);
        throw new Error(`Email provider error: ${errorText}`);
    }

    return { success: true };
}
