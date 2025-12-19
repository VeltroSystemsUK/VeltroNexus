import { storage } from "../storage";

// ============================================================================
// AI GOVERNANCE CONFIGURATION
// ============================================================================

export const AI_GOVERNANCE_CONFIG = {
  // Request size limits (in bytes)
  maxCsvSize: parseInt(process.env.AI_MAX_CSV_SIZE || '512000'), // 500KB default
  maxPdfTextSize: parseInt(process.env.AI_MAX_PDF_TEXT_SIZE || '204800'), // 200KB default
  maxTotalRequestSize: parseInt(process.env.AI_MAX_TOTAL_REQUEST_SIZE || '2097152'), // 2MB default
  maxPdfFiles: parseInt(process.env.AI_MAX_PDF_FILES || '6'),
  maxDocuments: parseInt(process.env.AI_MAX_DOCUMENTS || '10'),
  
  // Chunking configuration
  chunkSizeBytes: parseInt(process.env.AI_CHUNK_SIZE || '102400'), // 100KB default
  
  // Retention configuration (in days)
  auditLogRetentionDays: parseInt(process.env.AI_AUDIT_LOG_RETENTION_DAYS || '90'),
  derivedArtifactRetentionDays: parseInt(process.env.AI_ARTIFACT_RETENTION_DAYS || '365'),
  
  // Redaction settings
  enableRedaction: process.env.AI_ENABLE_REDACTION !== 'false', // Default: true
};

// ============================================================================
// AUDIT LOG TYPES AND STORAGE
// ============================================================================

export interface AiAuditLogEntry {
  id: string;
  userId: string;
  operation: string;
  prospectId?: number;
  dataType: string;
  timestamp: Date;
  dataSizeBytes: number;
  consentGiven: boolean;
  redactionApplied: boolean;
  fieldsRedacted?: string[];
  chunksProcessed?: number;
  expiresAt?: Date;
}

const auditLog: AiAuditLogEntry[] = [];
let auditLogCounter = 0;

function generateAuditId(): string {
  return `ai_audit_${Date.now()}_${++auditLogCounter}`;
}

export function logAiOperation(entry: Omit<AiAuditLogEntry, 'id' | 'expiresAt'>): AiAuditLogEntry {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + AI_GOVERNANCE_CONFIG.auditLogRetentionDays);
  
  const fullEntry: AiAuditLogEntry = {
    ...entry,
    id: generateAuditId(),
    timestamp: new Date(),
    expiresAt,
  };
  
  auditLog.push(fullEntry);
  
  // Structured log output (never contains raw data)
  console.info(JSON.stringify({
    type: "ai_audit",
    id: fullEntry.id,
    operation: fullEntry.operation,
    userId: fullEntry.userId,
    prospectId: fullEntry.prospectId,
    dataType: fullEntry.dataType,
    dataSizeBytes: fullEntry.dataSizeBytes,
    consentGiven: fullEntry.consentGiven,
    redactionApplied: fullEntry.redactionApplied,
    fieldsRedacted: fullEntry.fieldsRedacted,
    chunksProcessed: fullEntry.chunksProcessed,
    timestamp: fullEntry.timestamp.toISOString(),
    expiresAt: fullEntry.expiresAt?.toISOString(),
  }));
  
  return fullEntry;
}

export function getAiAuditLog(userId?: string): AiAuditLogEntry[] {
  const now = new Date();
  const validLogs = auditLog.filter(entry => 
    (!entry.expiresAt || entry.expiresAt > now) &&
    (!userId || entry.userId === userId)
  );
  return [...validLogs];
}

export function pruneExpiredAuditLogs(): number {
  const now = new Date();
  const initialLength = auditLog.length;
  const validLogs = auditLog.filter(entry => !entry.expiresAt || entry.expiresAt > now);
  auditLog.length = 0;
  auditLog.push(...validLogs);
  return initialLength - auditLog.length;
}

// ============================================================================
// FIELD-LEVEL REDACTION
// ============================================================================

interface RedactionPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const REDACTION_PATTERNS: RedactionPattern[] = [
  // Financial identifiers
  { name: 'iban', regex: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{0,2}\b/gi, replacement: "[REDACTED_IBAN]" },
  { name: 'account_number', regex: /\b\d{6,8}\s?\d{6,8}\b/g, replacement: "[REDACTED_ACCOUNT]" },
  { name: 'sort_code', regex: /\b\d{2}-\d{2}-\d{2}\b/g, replacement: "[REDACTED_SORT_CODE]" },
  { name: 'credit_card', regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, replacement: "[REDACTED_CARD]" },
  
  // Personal identifiers
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[REDACTED_EMAIL]" },
  { name: 'phone_uk', regex: /\b(?:\+44|0)\s?(?:7\d{3}|\d{4})\s?\d{6}\b/g, replacement: "[REDACTED_PHONE]" },
  { name: 'phone_intl', regex: /\b\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g, replacement: "[REDACTED_PHONE]" },
  { name: 'ni_number', regex: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, replacement: "[REDACTED_NI]" },
  { name: 'passport', regex: /\b[0-9]{9}\b/g, replacement: "[REDACTED_PASSPORT]" },
  
  // Names with titles
  { name: 'titled_name', regex: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Dame)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g, replacement: "[REDACTED_NAME]" },
  
  // Addresses
  { name: 'postcode_uk', regex: /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi, replacement: "[REDACTED_POSTCODE]" },
  { name: 'address_line', regex: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Court|Ct|Close|Cl|Way|Place|Pl|Crescent|Cres|Gardens|Gdns|Terrace|Ter)\b/gi, replacement: "[REDACTED_ADDRESS]" },
  
  // Company registration numbers
  { name: 'company_number', regex: /\b(?:SC|NI|OC|SO|NC|NL|R)?\d{6,8}\b/g, replacement: "[REDACTED_COMPANY_REG]" },
  
  // Date of birth patterns
  { name: 'dob', regex: /\b(?:DOB|Date of Birth|Born)[:\s]+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi, replacement: "[REDACTED_DOB]" },
];

export function redactSensitiveData(data: string): { 
  redacted: string; 
  redactionApplied: boolean; 
  fieldsRedacted: string[];
} {
  if (!AI_GOVERNANCE_CONFIG.enableRedaction) {
    return { redacted: data, redactionApplied: false, fieldsRedacted: [] };
  }
  
  let redacted = data;
  const fieldsRedacted: string[] = [];
  
  for (const pattern of REDACTION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(redacted)) {
      fieldsRedacted.push(pattern.name);
      pattern.regex.lastIndex = 0;
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }
  
  return { 
    redacted, 
    redactionApplied: fieldsRedacted.length > 0, 
    fieldsRedacted 
  };
}

// ============================================================================
// DATA MINIMIZATION
// ============================================================================

export interface MinimizationConfig {
  allowedFields?: string[];
  excludeFields?: string[];
  maxRowCount?: number;
  numericOnly?: boolean;
}

export function minimizeCsvData(
  csvData: string, 
  config: MinimizationConfig = {}
): { minimized: string; rowsRemoved: number; fieldsRemoved: string[] } {
  const lines = csvData.trim().split('\n');
  if (lines.length === 0) {
    return { minimized: '', rowsRemoved: 0, fieldsRemoved: [] };
  }
  
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
  const dataLines = lines.slice(1);
  
  let rowsRemoved = 0;
  const fieldsRemoved: string[] = [];
  
  // Determine which columns to keep
  let columnsToKeep: number[] = [];
  
  if (config.allowedFields && config.allowedFields.length > 0) {
    // Only keep allowed fields
    columnsToKeep = headers
      .map((h, i) => config.allowedFields!.some(f => h.includes(f.toLowerCase())) ? i : -1)
      .filter(i => i >= 0);
    fieldsRemoved.push(...headers.filter((h, i) => !columnsToKeep.includes(i)));
  } else if (config.excludeFields && config.excludeFields.length > 0) {
    // Remove excluded fields
    columnsToKeep = headers
      .map((h, i) => config.excludeFields!.some(f => h.includes(f.toLowerCase())) ? -1 : i)
      .filter(i => i >= 0);
    fieldsRemoved.push(...headers.filter((h, i) => !columnsToKeep.includes(i)));
  } else {
    columnsToKeep = headers.map((_, i) => i);
  }
  
  // Filter function for rows
  const filterRow = (line: string): string | null => {
    const values = line.split(',');
    const filteredValues = columnsToKeep.map(i => values[i] || '');
    
    if (config.numericOnly) {
      // For numeric-only mode, verify at least one column has numeric data
      const hasNumeric = filteredValues.some(v => /[\d.]+/.test(v));
      if (!hasNumeric) return null;
    }
    
    return filteredValues.join(',');
  };
  
  // Build minimized output
  const newHeader = columnsToKeep.map(i => headers[i]).join(',');
  const newData: string[] = [];
  
  for (const line of dataLines) {
    if (config.maxRowCount && newData.length >= config.maxRowCount) {
      rowsRemoved += dataLines.length - newData.length;
      break;
    }
    
    const filtered = filterRow(line);
    if (filtered) {
      newData.push(filtered);
    } else {
      rowsRemoved++;
    }
  }
  
  return {
    minimized: [newHeader, ...newData].join('\n'),
    rowsRemoved,
    fieldsRemoved,
  };
}

export function minimizeJsonData(
  data: Record<string, any>,
  allowedKeys: string[]
): { minimized: Record<string, any>; keysRemoved: string[] } {
  const keysRemoved: string[] = [];
  const minimized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase();
    if (allowedKeys.some(k => normalizedKey.includes(k.toLowerCase()))) {
      minimized[key] = value;
    } else {
      keysRemoved.push(key);
    }
  }
  
  return { minimized, keysRemoved };
}

// ============================================================================
// REQUEST SIZE VALIDATION AND CHUNKING
// ============================================================================

export interface SizeValidationResult {
  valid: boolean;
  error?: string;
  sizeBytes: number;
}

export function validateRequestSize(
  data: string | Buffer,
  maxSize: number = AI_GOVERNANCE_CONFIG.maxTotalRequestSize
): SizeValidationResult {
  const sizeBytes = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.length;
  
  if (sizeBytes > maxSize) {
    return {
      valid: false,
      error: `Data size (${Math.round(sizeBytes / 1024)}KB) exceeds limit (${Math.round(maxSize / 1024)}KB)`,
      sizeBytes,
    };
  }
  
  return { valid: true, sizeBytes };
}

export function chunkData(
  data: string,
  chunkSize: number = AI_GOVERNANCE_CONFIG.chunkSizeBytes
): string[] {
  const chunks: string[] = [];
  const bytes = Buffer.from(data, 'utf8');
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    chunks.push(chunk.toString('utf8'));
  }
  
  return chunks;
}

export function chunkCsvByRows(
  csvData: string,
  maxRowsPerChunk: number = 500
): string[] {
  const lines = csvData.trim().split('\n');
  if (lines.length <= 1) return [csvData];
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  const chunks: string[] = [];
  
  for (let i = 0; i < dataLines.length; i += maxRowsPerChunk) {
    const chunkLines = dataLines.slice(i, i + maxRowsPerChunk);
    chunks.push([header, ...chunkLines].join('\n'));
  }
  
  return chunks;
}

// ============================================================================
// CONSENT VERIFICATION
// ============================================================================

export async function verifyAiConsent(userId: string): Promise<{ 
  hasConsent: boolean; 
  message?: string;
  consentedAt?: Date;
}> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return { hasConsent: false, message: "User not found" };
    }
    
    const aiDataConsent = (user as any).aiDataConsent;
    const aiDataConsentAt = (user as any).aiDataConsentAt;
    
    if (!aiDataConsent) {
      return { 
        hasConsent: false, 
        message: "AI data processing consent required. Please enable AI features in Settings to continue." 
      };
    }
    
    return { 
      hasConsent: true,
      consentedAt: aiDataConsentAt ? new Date(aiDataConsentAt) : undefined,
    };
  } catch (error) {
    console.error("Error verifying AI consent:", error);
    return { hasConsent: false, message: "Failed to verify consent" };
  }
}

export function verifyPerRequestConsent(consentFlag: boolean): { 
  valid: boolean; 
  message?: string 
} {
  if (!consentFlag) {
    return { 
      valid: false, 
      message: "Explicit consent for AI processing is required for this request" 
    };
  }
  return { valid: true };
}

// ============================================================================
// GOVERNANCE WRAPPER
// ============================================================================

export interface AiRequestContext {
  userId: string;
  prospectId?: number;
  operation: string;
  dataType: string;
  consentToAiProcessing: boolean;
}

export interface AiGovernanceOptions {
  skipRedaction?: boolean;
  minimization?: MinimizationConfig;
  maxSize?: number;
}

export interface AiGovernanceResult<T> {
  result: T;
  auditEntry: AiAuditLogEntry;
  processingStats: {
    originalSizeBytes: number;
    processedSizeBytes: number;
    redactionApplied: boolean;
    fieldsRedacted: string[];
    chunksProcessed: number;
  };
}

export async function wrapAiRequest<T>(
  context: AiRequestContext,
  data: string,
  aiOperation: (processedData: string) => Promise<T>,
  options: AiGovernanceOptions = {}
): Promise<AiGovernanceResult<T> | { error: string; code: number }> {
  const { userId, prospectId, operation, dataType, consentToAiProcessing } = context;
  const originalSizeBytes = Buffer.byteLength(data, 'utf8');
  
  // Step 1: Verify user-level consent
  const userConsent = await verifyAiConsent(userId);
  if (!userConsent.hasConsent) {
    return { error: userConsent.message || "AI consent not granted", code: 403 };
  }
  
  // Step 2: Verify per-request consent
  const requestConsent = verifyPerRequestConsent(consentToAiProcessing);
  if (!requestConsent.valid) {
    return { error: requestConsent.message || "Per-request consent not granted", code: 400 };
  }
  
  // Step 3: Validate request size
  const sizeCheck = validateRequestSize(data, options.maxSize);
  if (!sizeCheck.valid) {
    return { error: sizeCheck.error || "Request too large", code: 413 };
  }
  
  // Step 4: Apply redaction
  let processedData = data;
  let redactionApplied = false;
  let fieldsRedacted: string[] = [];
  
  if (!options.skipRedaction) {
    const redactionResult = redactSensitiveData(data);
    processedData = redactionResult.redacted;
    redactionApplied = redactionResult.redactionApplied;
    fieldsRedacted = redactionResult.fieldsRedacted;
  }
  
  // Step 5: Apply data minimization for CSV data
  let rowsRemoved = 0;
  if (options.minimization && dataType === 'csv') {
    const minimizationResult = minimizeCsvData(processedData, options.minimization);
    processedData = minimizationResult.minimized;
    rowsRemoved = minimizationResult.rowsRemoved;
    if (minimizationResult.fieldsRemoved.length > 0) {
      fieldsRedacted.push(...minimizationResult.fieldsRemoved.map(f => `field:${f}`));
    }
  }
  
  const processedSizeBytes = Buffer.byteLength(processedData, 'utf8');
  
  // Step 6: Create audit entry (before operation, in case of failure)
  const auditEntry = logAiOperation({
    userId,
    operation,
    prospectId,
    dataType,
    timestamp: new Date(),
    dataSizeBytes: processedSizeBytes,
    consentGiven: true,
    redactionApplied,
    fieldsRedacted: fieldsRedacted.length > 0 ? fieldsRedacted : undefined,
    chunksProcessed: 1,
  });
  
  // Step 7: Execute AI operation
  try {
    const result = await aiOperation(processedData);
    
    return {
      result,
      auditEntry,
      processingStats: {
        originalSizeBytes,
        processedSizeBytes,
        redactionApplied,
        fieldsRedacted,
        chunksProcessed: 1,
      },
    };
  } catch (error: any) {
    // Log failure (without raw data)
    console.error(JSON.stringify({
      type: "ai_operation_failed",
      auditId: auditEntry.id,
      operation,
      userId,
      prospectId,
      errorType: error.name || 'Error',
      timestamp: new Date().toISOString(),
    }));
    throw error;
  }
}

// ============================================================================
// PREMIUM CHECK HELPER
// ============================================================================

export async function requirePremiumAndConsent(
  userId: string,
  consentToAiProcessing: boolean
): Promise<{ authorized: boolean; error?: string; code?: number }> {
  const user = await storage.getUser(userId);
  
  if (!user) {
    return { authorized: false, error: "User not found", code: 404 };
  }
  
  if (user.subscriptionTier !== 'premium') {
    return { authorized: false, error: "Premium subscription required for Credit Underwriting", code: 403 };
  }
  
  const userConsent = await verifyAiConsent(userId);
  if (!userConsent.hasConsent) {
    return { 
      authorized: false, 
      error: userConsent.message || "AI data processing consent required", 
      code: 403 
    };
  }
  
  const requestConsent = verifyPerRequestConsent(consentToAiProcessing);
  if (!requestConsent.valid) {
    return { 
      authorized: false, 
      error: requestConsent.message || "Per-request consent required", 
      code: 400 
    };
  }
  
  return { authorized: true };
}

// ============================================================================
// CONSENT NOTICE
// ============================================================================

export const AI_DATA_CONSENT_NOTICE = `
By enabling AI-powered financial analysis, you consent to:
1. Your financial data being processed by AI models to generate insights
2. Sensitive personal information being automatically redacted before processing
3. An audit log being maintained for compliance purposes (retained for ${AI_GOVERNANCE_CONFIG.auditLogRetentionDays} days)

Data protection measures:
- Personal identifiers (names, addresses, account numbers, emails, phone numbers) are automatically redacted
- Only the minimum required data is sent to AI models
- Raw financial data is never logged or stored

You can revoke this consent at any time in Settings.
`.trim();
