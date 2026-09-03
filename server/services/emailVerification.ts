
import { resolveMx } from 'dns/promises';
import { Socket } from 'net';
import { zeroBounceClient } from '../utils/zeroBounceClient';
import { mxFamilyFromHosts, smtpTrusted, type SmtpProbe } from '@shared/mailboxScore';

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

        // 4. ZeroBounce Fallback (if SMTP failed and API key is configured)
        if (deepMode && !smtpValid && zeroBounceClient.isConfigured()) {
            try {
                addLog('> SMTP UNAVAILABLE - Using ZeroBounce API...');
                const zbResult = await zeroBounceClient.validateEmail(emailLower);

                if (zbResult) {
                    addLog(`> ZEROBOUNCE STATUS: ${zbResult.status.toUpperCase()}`);
                    const mapped = zeroBounceClient.mapToQualityGrade(zbResult);

                    return {
                        email: emailLower,
                        syntaxValid: true,
                        domainValid: zbResult.mx_found === 'true',
                        isFreeMail: zbResult.free_email,
                        isRoleBased,
                        isDisposable: ['spamtrap', 'abuse', 'do_not_mail'].includes(zbResult.status),
                        deliverabilityScore: mapped.deliverabilityScore,
                        qualityGrade: mapped.qualityGrade,
                        status: mapped.status,
                        explanation: mapped.explanation,
                        logs
                    };
                }
            } catch (err: any) {
                addLog(`> ZEROBOUNCE FAILED: ${err.message}`);
            }
        }

        // Calculate Score (fallback to local validation)
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

    async probeMailbox(email: string): Promise<SmtpProbe> {
        const domain = String(email || "").split("@")[1];
        if (!domain) return "unknown";
        let hosts: string[] = [];
        try {
            const records = await resolveMx(domain);
            hosts = (records || []).sort((a, b) => a.priority - b.priority).map((row) => row.exchange);
        } catch {
            return "unknown";
        }
        if (!hosts.length) return "unknown";
        if (!smtpTrusted(mxFamilyFromHosts(hosts))) return "unknown";
        const addLog = (_msg: string) => undefined;
        const code = await this.smtpReplyCode(hosts[0], email, addLog);
        if (code === 250 || code === 251) return "deliverable";
        if (code === 550 || code === 551 || code === 553) return "user_unknown";
        return "unknown";
    }

    private smtpReplyCode(host: string, email: string, addLog: (m: string) => void): Promise<number> {
        return new Promise((resolve) => {
            const socket = new Socket();
            let step = 0;
            let code = 0;
            socket.setTimeout(5000);
            socket.connect(587, host);
            const finish = (value: number) => {
                try {
                    socket.destroy();
                } catch {
                    // ignore
                }
                resolve(value);
            };
            socket.on("data", (data) => {
                const response = data.toString();
                code = parseInt(response.substring(0, 3), 10) || 0;
                addLog(`> S: ${response.trim()}`);
                if (step === 0 && code === 220) {
                    socket.write(`EHLO veltro-verify.co.uk\r\n`);
                    step++;
                } else if (step === 1 && (code === 250 || code === 220)) {
                    socket.write(`MAIL FROM: <verify@veltro.co.uk>\r\n`);
                    step++;
                } else if (step === 2 && code === 250) {
                    socket.write(`RCPT TO: <${email}>\r\n`);
                    step++;
                } else if (step === 3) {
                    socket.write("QUIT\r\n");
                    finish(code);
                }
            });
            socket.on("error", () => finish(0));
            socket.on("timeout", () => finish(0));
            socket.on("close", () => finish(code));
        });
    }

    private async smtpCheck(host: string, email: string, addLog: (m: string) => void): Promise<boolean> {
        // Try port 587 first (submission port - more likely to be unblocked)
        const result587 = await this.smtpCheckPort(587, host, email, addLog);
        if (result587) return true;

        addLog('> PORT 587 FAILED - Trying port 25 as fallback...');

        // Fallback to port 25
        return this.smtpCheckPort(25, host, email, addLog);
    }

    private smtpCheckPort(port: number, host: string, email: string, addLog: (m: string) => void): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new Socket();
            let step = 0;
            let success = false;

            socket.setTimeout(5000);
            socket.connect(port, host);

            socket.on('connect', () => {
                addLog(`> CONNECTED TO ${host}:${port}`);
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
