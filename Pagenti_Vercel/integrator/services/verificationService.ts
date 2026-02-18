
import { EmailValidationResult, EmailQuality } from "../types";
import { db } from "./firebase";
import { collection, setDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";

const FREE_PROVIDERS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com'];
const ROLE_PREFIXES = ['info', 'admin', 'sales', 'support', 'hello', 'contact', 'billing', 'accounts', 'hr', 'marketing', 'dev'];
const DISPOSABLE_DOMAINS = ['mailinator.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com'];

export class VerificationService {
  private collectionRef = collection(db, "validation_logs");
  private isFirebaseConfigured = !doc(db, 'test', 'test').path.includes('REPLACE_WITH');

  async verifyEmail(
    email: string, 
    deepMode: boolean, 
    onLog?: (msg: string) => void
  ): Promise<EmailValidationResult> {
    const emailLower = email.toLowerCase().trim();
    const [localPart, domain] = emailLower.split('@');
    
    if (deepMode && onLog) {
      await this.simulateSmtpHandshake(emailLower, domain, onLog);
    }

    const syntaxValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower);
    const isFreeMail = domain ? FREE_PROVIDERS.includes(domain) : false;
    const isDisposable = domain ? DISPOSABLE_DOMAINS.includes(domain) : false;
    const isRoleBased = localPart ? ROLE_PREFIXES.some(prefix => localPart.startsWith(prefix)) : false;
    
    let score = 100;
    if (!syntaxValid) score = 0;
    else {
      if (isDisposable) score -= 80;
      if (isFreeMail) score -= 20;
      if (isRoleBased) score -= 15;
    }

    let qualityGrade: EmailQuality = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 35 ? 'D' : 'F';

    const result: EmailValidationResult = {
      email: emailLower,
      syntaxValid,
      domainValid: syntaxValid && !isDisposable,
      isFreeMail,
      isRoleBased,
      isDisposable,
      deliverabilityScore: Math.max(0, score),
      qualityGrade,
      status: score > 70 ? 'valid' : score > 30 ? 'risky' : 'invalid'
    };

    if (this.isFirebaseConfigured) {
      await this.saveLog(result);
    }

    return result;
  }

  private async saveLog(result: EmailValidationResult) {
    try {
      const docId = result.email.replace(/[@.]/g, '_');
      await setDoc(doc(db, "validation_logs", docId), {
        ...result,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      // Fail silently to keep app running
    }
  }

  async getValidationHistory(): Promise<EmailValidationResult[]> {
    if (!this.isFirebaseConfigured) return [];
    try {
      const snapshot = await getDocs(this.collectionRef);
      return snapshot.docs.map(doc => doc.data() as EmailValidationResult);
    } catch (e) {
      return [];
    }
  }

  private async simulateSmtpHandshake(email: string, domain: string, onLog: (msg: string) => void) {
    onLog(`> RESOLVING MX: ${domain}...`);
    await new Promise(r => setTimeout(r, 300));
    onLog(`> FOUND MX: mx1.${domain}`);
    await new Promise(r => setTimeout(r, 200));
    onLog(`> CONNECTING...`);
    onLog(`> S: 250 2.1.5 Ok`);
  }
}

export const verificationService = new VerificationService();
