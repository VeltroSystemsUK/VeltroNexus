/**
 * enrichers/emailValidator.ts
 * Email validation (syntax + MX record) and PECR eligibility assessment.
 * Uses Node's built-in dns.promises — no external dependency needed.
 */

import { promises as dns } from 'dns';
import { Business, EmailConfidence, PECRStatus } from '../models/business.js';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com',
  'live.com', 'msn.com', 'aol.com', 'btinternet.com',
  'sky.com', 'talktalk.net', 'virginmedia.com',
]);

// Role-based prefixes that indicate a B2B contact point
const BUSINESS_PREFIXES = new Set([
  'info', 'contact', 'hello', 'enquiries', 'enquiry',
  'sales', 'admin', 'office', 'mail', 'team', 'support',
  'accounts', 'finance', 'lending', 'broker',
]);

// ─────────────────────────────────────────────
// Email validation
// ─────────────────────────────────────────────

export async function validateEmail(
  email: string
): Promise<{ valid: boolean; confidence: EmailConfidence }> {
  if (!checkSyntax(email)) {
    return { valid: false, confidence: EmailConfidence.UNVERIFIED };
  }

  const domain = email.split('@')[1]!;
  const hasMx = await checkMxRecord(domain);

  if (!hasMx) {
    return { valid: false, confidence: EmailConfidence.UNVERIFIED };
  }

  return { valid: true, confidence: EmailConfidence.MEDIUM };
}

export async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

function checkSyntax(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

// ─────────────────────────────────────────────
// PECR assessment
// ─────────────────────────────────────────────

/**
 * Heuristic assessment of PECR eligibility for UK B2B cold email.
 *
 * PECR (Privacy and Electronic Communications Regulations) permits
 * B2B cold email to corporate bodies if:
 *   - The address is corporate, not personal
 *   - There is a legitimate interest basis
 *   - The contact is relevant to the business activity
 *
 * This is a heuristic, not legal advice.
 */
export function assessPecrEligibility(business: Business): PECRStatus {
  if (!business.email) return PECRStatus.NOT_ASSESSED;

  const email = business.email.toLowerCase();
  const domain = email.split('@')[1] ?? '';
  const prefix = email.split('@')[0] ?? '';

  // Personal domain = ineligible
  if (PERSONAL_DOMAINS.has(domain)) return PECRStatus.INELIGIBLE;

  // Role-based prefix on business domain = eligible
  if (BUSINESS_PREFIXES.has(prefix)) return PECRStatus.ELIGIBLE;

  // Named individual pattern (e.g. john.smith@ or johnsmith@) = uncertain
  if (/^[a-z]+\.[a-z]+$/.test(prefix) || /^[a-z]{4,}$/.test(prefix)) {
    return PECRStatus.UNCERTAIN;
  }

  // Default: eligible if on business domain with no red flags
  return PECRStatus.ELIGIBLE;
}
