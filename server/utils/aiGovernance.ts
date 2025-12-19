import { storage } from "../storage";

interface AiAuditLogEntry {
  userId: string;
  operation: string;
  prospectId?: number;
  dataType: string;
  timestamp: Date;
  dataSizeBytes: number;
  consentGiven: boolean;
  redactionApplied: boolean;
}

const auditLog: AiAuditLogEntry[] = [];

export function logAiOperation(entry: AiAuditLogEntry): void {
  const logEntry = {
    ...entry,
    timestamp: new Date(),
  };
  auditLog.push(logEntry);
  
  console.info(JSON.stringify({
    type: "ai_audit",
    ...logEntry,
  }));
}

export function getAiAuditLog(): AiAuditLogEntry[] {
  return [...auditLog];
}

export function redactSensitiveData(data: string): { redacted: string; redactionApplied: boolean } {
  let redacted = data;
  let redactionApplied = false;
  
  const patterns = [
    { regex: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{0,2}\b/gi, replacement: "[REDACTED_IBAN]" },
    { regex: /\b\d{6}\s?\d{8}\b/g, replacement: "[REDACTED_ACCOUNT]" },
    { regex: /\b\d{2}-\d{2}-\d{2}\b/g, replacement: "[REDACTED_SORT_CODE]" },
    { regex: /\b(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, replacement: "[REDACTED_NAME]" },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[REDACTED_EMAIL]" },
    { regex: /\b(?:\+44|0)\s?7\d{3}\s?\d{6}\b/g, replacement: "[REDACTED_PHONE]" },
    { regex: /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi, replacement: "[REDACTED_POSTCODE]" },
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(redacted)) {
      redactionApplied = true;
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }
  
  return { redacted, redactionApplied };
}

export async function verifyAiConsent(userId: string): Promise<{ hasConsent: boolean; message?: string }> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return { hasConsent: false, message: "User not found" };
    }
    
    const aiDataConsent = (user as any).aiDataConsent;
    if (!aiDataConsent) {
      return { 
        hasConsent: false, 
        message: "AI data processing consent required. Please enable AI features in Settings to continue." 
      };
    }
    
    return { hasConsent: true };
  } catch (error) {
    console.error("Error verifying AI consent:", error);
    return { hasConsent: false, message: "Failed to verify consent" };
  }
}

export interface AiRequestContext {
  userId: string;
  prospectId?: number;
  operation: string;
  dataType: string;
}

export async function wrapAiRequest<T>(
  context: AiRequestContext,
  data: string,
  aiOperation: (processedData: string) => Promise<T>
): Promise<{ result: T; auditEntry: AiAuditLogEntry } | { error: string }> {
  const { userId, prospectId, operation, dataType } = context;
  
  const consentCheck = await verifyAiConsent(userId);
  if (!consentCheck.hasConsent) {
    return { error: consentCheck.message || "AI consent not granted" };
  }
  
  const { redacted, redactionApplied } = redactSensitiveData(data);
  
  const auditEntry: AiAuditLogEntry = {
    userId,
    operation,
    prospectId,
    dataType,
    timestamp: new Date(),
    dataSizeBytes: Buffer.byteLength(redacted, 'utf8'),
    consentGiven: true,
    redactionApplied,
  };
  
  logAiOperation(auditEntry);
  
  try {
    const result = await aiOperation(redacted);
    return { result, auditEntry };
  } catch (error: any) {
    console.error(`AI operation failed: ${operation}`, error);
    throw error;
  }
}

export const AI_DATA_CONSENT_NOTICE = `
By enabling AI-powered financial analysis, you consent to:
1. Your financial data being processed by AI models to generate insights
2. Sensitive personal information being automatically redacted before processing
3. An audit log being maintained for compliance purposes

You can revoke this consent at any time in Settings.
`.trim();
