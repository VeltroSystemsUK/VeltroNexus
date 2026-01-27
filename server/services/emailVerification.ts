
import { resolveMx } from 'dns/promises';
import { Socket } from 'net';

export interface EmailVerificationResult {
    email: string;
    syntaxValid: boolean;
    domainValid: boolean;
    isFreeMail: boolean;
    isRoleBased: boolean;
    isDisposable: boolean;
    deliverabilityScore: number;
    qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    status: 'valid' | 'risky' | 'invalid';
    explanation: string;
    logs?: string[];
}

const FREE_PROVIDERS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com'];
const ROLE_PREFIXES = ['info', 'admin', 'sales', 'support', 'hello', 'contact', 'billing', 'accounts', 'hr', 'marketing', 'dev'];

export class EmailVerificationService {
    async verify(email: string, deepMode: boolean): Promise<EmailVerificationResult> {
        const logs: string[] = [];
        const addLog = (msg: string) => logs.push(msg);

        const emailLower = email.toLowerCase().trim();
        const [localPart, domain] = emailLower.split('@');

        // 1. Syntax Check
        const syntaxValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower);
        if (!syntaxValid) {
            return {
                email: emailLower,
                syntaxValid: false,
                domainValid: false,
                isFreeMail: false,
                isRoleBased: false,
                isDisposable: false,
                deliverabilityScore: 0,
                qualityGrade: 'F',
                status: 'invalid',
                explanation: "Invalid email syntax - does not follow RFC standards.",
                logs: ["Invalid email syntax"]
            };
        }

        const isFreeMail = FREE_PROVIDERS.includes(domain);
        const isRoleBased = ROLE_PREFIXES.some(prefix => localPart.startsWith(prefix));

        // 2. Domain Check (MX Lookup)
        let domainValid = false;
        let mxHost = '';
        try {
            addLog(`> RESOLVING MX: ${domain}...`);
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                mxRecords.sort((a, b) => a.priority - b.priority);
                mxHost = mxRecords[0].exchange;
                addLog(`> FOUND MX: ${mxHost} [Priority ${mxRecords[0].priority}]`);
                domainValid = true;
            } else {
                addLog(`> NO MX RECORDS FOUND for ${domain}`);
            }
        } catch (err: any) {
            addLog(`> DNS RESOLUTION FAILED: ${err.message}`);
        }

        if (!domainValid) {
            return {
                email: emailLower,
                syntaxValid: true,
                domainValid: false,
                isFreeMail,
                isRoleBased,
                isDisposable: false,
                deliverabilityScore: 20,
                qualityGrade: 'F',
                status: 'invalid',
                explanation: "Critical Failure: No MX (Mail Exchange) records found for domain. Server cannot receive emails.",
                logs
            };
        }

        // 3. SMTP Handshake (optional Deep Mode)
        let smtpValid = false;
        if (deepMode && mxHost) {
            try {
                smtpValid = await this.smtpCheck(mxHost, emailLower, addLog);
            } catch (err: any) {
                addLog(`> SMTP CHECK FAILED: ${err.message}`);
            }
        }

        // Calculate Score
        let score = 100;
        if (isFreeMail) score -= 20;
        if (isRoleBased) score -= 15;
        if (deepMode && !smtpValid) score -= 50;

        let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
        if (score >= 90) qualityGrade = 'A';
        else if (score >= 75) qualityGrade = 'B';
        else if (score >= 55) qualityGrade = 'C';
        else if (score >= 35) qualityGrade = 'D';

        return {
            email: emailLower,
            syntaxValid: true,
            domainValid: true,
            isFreeMail,
            isRoleBased,
            isDisposable: false,
            deliverabilityScore: Math.max(0, score),
            qualityGrade,
            status: score > 70 ? 'valid' : score > 30 ? 'risky' : 'invalid',
            explanation: this.getExplanation(score, isFreeMail, isRoleBased, deepMode, smtpValid),
            logs
        };
    }

    private getExplanation(score: number, isFree: boolean, isRole: boolean, deep: boolean, smtp: boolean): string {
        const reasons: string[] = [];
        if (score >= 90) reasons.push("Optimum: Primary corporate domain with high integrity signals.");
        else if (score >= 75) reasons.push("High Quality: Validated enterprise domain.");
        else if (score >= 55) reasons.push("Average: Consumer or legacy domain detected.");
        else reasons.push("Low Integrity: Multiple risk factors detected.");

        if (isFree) reasons.push("Note: Generic provider (Gmail/Yahoo/etc).");
        if (isRole) reasons.push("Note: Role-based identity (info/admin) may have lower engagement.");
        if (deep && !smtp) reasons.push("Warning: SMTP handshake failed - mailbox may be inactive.");
        if (deep && smtp) reasons.push("Security: Passive SMTP handshake verified mailbox existence.");

        return reasons.join(" ");
    }

    private smtpCheck(host: string, email: string, addLog: (m: string) => void): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new Socket();
            let step = 0;
            let success = false;

            socket.setTimeout(5000);
            socket.connect(25, host);

            socket.on('connect', () => {
                addLog(`> CONNECTED TO ${host}:25`);
            });

            socket.on('data', (data) => {
                const response = data.toString();
                const code = parseInt(response.substring(0, 3));
                addLog(`> S: ${response.trim()}`);

                if (step === 0 && code === 220) {
                    socket.write(`EHLO veltro-verify.co.uk\r\n`);
                    addLog(`> C: EHLO veltro-verify.co.uk`);
                    step++;
                } else if (step === 1 && code === 250) {
                    socket.write(`MAIL FROM: <verify@veltro.co.uk>\r\n`);
                    addLog(`> C: MAIL FROM: <verify@veltro.co.uk>`);
                    step++;
                } else if (step === 2 && code === 250) {
                    socket.write(`RCPT TO: <${email}>\r\n`);
                    addLog(`> C: RCPT TO: <${email}>`);
                    step++;
                } else if (step === 3) {
                    if (code === 250) {
                        success = true;
                    }
                    socket.write('QUIT\r\n');
                    addLog('> C: QUIT');
                    socket.end();
                }
            });

            socket.on('error', (err) => {
                addLog(`> SOCKET ERROR: ${err.message}`);
                socket.destroy();
                resolve(false);
            });

            socket.on('timeout', () => {
                addLog(`> CONNECTION TIMEOUT`);
                socket.destroy();
                resolve(false);
            });

            socket.on('close', () => {
                resolve(success);
            });
        });
    }
}

export const emailVerificationService = new EmailVerificationService();
