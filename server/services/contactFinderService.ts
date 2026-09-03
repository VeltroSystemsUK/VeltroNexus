import { InternalLead } from "../../shared/schema";
import { ai } from "../utils/geminiClient";
import { companiesHouseClient } from "../utils/companiesHouseClient";

export interface FoundContact {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

// --- Stage 1: Companies House Officers ---

function parseOfficerName(raw: string): { firstName: string; lastName: string; fullName: string } {
  // Companies House format: "SURNAME, Forename Middlename" or just "Forename Surname"
  if (raw.includes(",")) {
    const [surnamePart, forenamesPart] = raw.split(",").map((s) => s.trim());
    const surname = surnamePart.charAt(0) + surnamePart.slice(1).toLowerCase();
    const forenames = forenamesPart
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const firstName = forenames.split(" ")[0];
    return { firstName, lastName: surname, fullName: `${forenames} ${surname}` };
  }
  const parts = raw.split(" ");
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: raw,
  };
}

async function fetchOfficers(
  companyNumber: string
): Promise<Array<{ name: string; firstName: string; lastName: string; role: string }>> {
  try {
    const officers = await companiesHouseClient.getCompanyOfficers(companyNumber);
    if (!Array.isArray(officers)) return [];

    return officers
      .filter((o: any) => !o.resigned_on) // Active officers only
      .map((o: any) => {
        const parsed = parseOfficerName(o.name || "");
        return {
          name: parsed.fullName,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          role: o.officer_role?.replace(/-/g, " ") || "director",
        };
      })
      .filter((o) => o.name.length > 2);
  } catch (err) {
    console.warn("[ContactFinder] Failed to fetch officers:", err);
    return [];
  }
}

// --- Stage 2: Website Scraping ---

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const UK_PHONE_REGEX = /(?:(?:\+44\s?|0)(?:\d[\s\-]?){9,10})/g;

async function scrapeWebsiteContacts(
  websiteUrl: string
): Promise<{ emails: string[]; phones: string[] }> {
  const emails = new Set<string>();
  const phones = new Set<string>();

  const paths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team", "/our-team"];
  const baseUrl = websiteUrl.replace(/\/$/, "");

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const html = await res.text();

      // Extract emails
      const foundEmails = html.match(EMAIL_REGEX) || [];
      foundEmails.forEach((e) => {
        const lower = e.toLowerCase();
        // Skip image/asset files
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".gif") || lower.endsWith(".svg")) return;
        emails.add(lower);
      });

      // Extract phones
      const foundPhones = html.match(UK_PHONE_REGEX) || [];
      foundPhones.forEach((p) => phones.add(p.replace(/\s/g, "")));
    } catch {
      // Timeout or fetch error — skip this page
    }
  }

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
  };
}

// --- Stage 3: Gemini Targeted Search ---

async function searchContactDetails(
  companyName: string,
  officers: Array<{ name: string; role: string }>,
  website?: string
): Promise<
  Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
  }>
> {
  const officerList = officers
    .slice(0, 5)
    .map((o) => `- ${o.name} (${o.role})`)
    .join("\n");

  const prompt = `I need to find contact details for key people at a UK company called "${companyName}"${website ? ` (website: ${website})` : ""}.

These are the known directors/officers from Companies House:
${officerList || "No officers found — search for key decision makers."}

For each person, search for:
1. Their business email address (prefer @company domain emails)
2. Their LinkedIn profile URL
3. Their direct phone number

Also search for any other key contacts at this company (e.g., Finance Director, Managing Director, CEO, CFO, Business Development Manager) that are not in the list above.

Return ONLY valid JSON — no markdown, no explanation:
{
  "contacts": [
    {
      "name": "Full Name",
      "role": "Their Job Title",
      "email": "their@email.com or null",
      "phone": "+44... or null",
      "linkedinUrl": "https://linkedin.com/in/... or null"
    }
  ]
}

Important: Only include contacts you have reasonable evidence for. Do not fabricate email addresses.`;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Contact search timeout after 30s")), 30000)
    );

    const apiCall = ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
      }
    } as any);

    const response = await Promise.race([apiCall, timeoutPromise]);
    const raw = response.text?.trim() || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.contacts || []).filter(
      (c: any) => c.name && typeof c.name === "string" && c.name.length > 2
    );
  } catch (err) {
    console.warn("[ContactFinder] Gemini grounded search failed:", err);
    return [];
  }
}

// --- Contact Matching & Scoring ---

function emailMatchesName(email: string, firstName: string, lastName: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  const first = firstName.toLowerCase();
  const last = lastName.toLowerCase();

  return (
    local.includes(first) ||
    local.includes(last) ||
    local === `${first}.${last}` ||
    local === `${first[0]}.${last}` ||
    local === `${first}${last}` ||
    local === `${first[0]}${last}`
  );
}

function scoreContact(contact: FoundContact): number {
  let score = 0;
  if (contact.email) score += 40;
  if (contact.role?.toLowerCase().match(/director|ceo|cfo|founder|managing|owner|md/)) score += 30;
  if (contact.linkedinUrl) score += 15;
  if (contact.phone) score += 15;
  return score;
}

// --- Main Pipeline ---

export async function findContacts(lead: InternalLead): Promise<FoundContact[]> {
  console.log(`[ContactFinder] Starting 3-stage pipeline for ${lead.companyName}`);
  const contactMap = new Map<string, FoundContact>(); // keyed by name (lowercase)

  // Stage 1: Companies House Officers
  let officers: Array<{ name: string; firstName: string; lastName: string; role: string }> = [];
  if (lead.companyNumber) {
    officers = await fetchOfficers(lead.companyNumber);
    console.log(`[ContactFinder] Stage 1: Found ${officers.length} active officers`);

    for (const officer of officers) {
      contactMap.set(officer.name.toLowerCase(), {
        name: officer.name,
        role: officer.role,
        confidence: "high",
        source: "companies_house",
      });
    }
  }

  // Stage 2: Website Scraping
  let scrapedEmails: string[] = [];
  let scrapedPhones: string[] = [];
  if (lead.website) {
    const scraped = await scrapeWebsiteContacts(lead.website);
    scrapedEmails = scraped.emails;
    scrapedPhones = scraped.phones;
    console.log(
      `[ContactFinder] Stage 2: Scraped ${scrapedEmails.length} emails, ${scrapedPhones.length} phones from ${lead.website}`
    );

    // Try to match scraped emails to officers
    for (const email of scrapedEmails) {
      for (const officer of officers) {
        if (emailMatchesName(email, officer.firstName, officer.lastName)) {
          const key = officer.name.toLowerCase();
          const existing = contactMap.get(key);
          if (existing) {
            existing.email = email;
            existing.confidence = "high";
          }
        }
      }
    }
  }

  // Stage 3: Gemini Targeted Search
  const geminiContacts = await searchContactDetails(
    lead.companyName,
    officers.map((o) => ({ name: o.name, role: o.role })),
    lead.website
  );
  console.log(`[ContactFinder] Stage 3: Gemini returned ${geminiContacts.length} contacts`);

  for (const gc of geminiContacts) {
    const key = gc.name.toLowerCase();
    const existing = contactMap.get(key);
    if (existing) {
      // Merge Gemini data into existing officer
      if (!existing.email && gc.email) existing.email = gc.email;
      if (!existing.phone && gc.phone) existing.phone = gc.phone;
      if (!existing.linkedinUrl && gc.linkedinUrl) existing.linkedinUrl = gc.linkedinUrl;
      if (gc.role && gc.role.length > existing.role.length) existing.role = gc.role;
    } else {
      // New contact from Gemini
      contactMap.set(key, {
        name: gc.name,
        role: gc.role || "Contact",
        email: gc.email || undefined,
        phone: gc.phone || undefined,
        linkedinUrl: gc.linkedinUrl || undefined,
        confidence: gc.email ? "medium" : "low",
        source: "gemini_search",
      });
    }
  }

  // Assign any unmatched scraped emails to the first officer without an email
  for (const email of scrapedEmails) {
    const alreadyAssigned = [...contactMap.values()].some((c) => c.email === email);
    if (alreadyAssigned) continue;

    // Check if it's a generic email (info@, hello@, etc.)
    const local = email.split("@")[0].toLowerCase();
    const isGeneric = ["info", "hello", "contact", "admin", "sales", "support", "enquiries", "office"].includes(local);
    if (isGeneric) continue;

    // Try to assign to an officer without email
    for (const [, contact] of contactMap) {
      if (!contact.email) {
        contact.email = email;
        contact.confidence = "medium";
        break;
      }
    }
  }

  // Assign first scraped phone to contacts without phone
  if (scrapedPhones.length > 0) {
    for (const [, contact] of contactMap) {
      if (!contact.phone) {
        contact.phone = scrapedPhones[0];
        break;
      }
    }
  }

  // Score and sort
  const contacts = [...contactMap.values()];
  contacts.sort((a, b) => scoreContact(b) - scoreContact(a));

  console.log(
    `[ContactFinder] Pipeline complete for ${lead.companyName}: ${contacts.length} contacts found, ${contacts.filter((c) => c.email).length} with emails`
  );

  return contacts;
}

// --- Bulk Processing ---

export async function findContactsBulk(leadIds: number[], userId: string): Promise<void> {
  const { agentJobTracker } = await import("./agentJobTracker");
  const { storage } = await import("../storage");

  const jobId = await agentJobTracker.createJob(
    "contact-finder",
    userId,
    "data_enrichment",
    "Find Contacts",
    `Finding contacts for ${leadIds.length} leads`,
    leadIds.length
  );

  console.log(`[ContactFinder] Starting bulk contact discovery for ${leadIds.length} leads (Job: ${jobId})`);

  const BATCH_SIZE = 3;
  let completedCount = 0;

  const chunks: number[][] = [];
  for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
    chunks.push(leadIds.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    // Check if job was cancelled
    const currentJob = await agentJobTracker.getJob(jobId);
    if (!currentJob || currentJob.status !== "running") {
      console.log(`[ContactFinder] Job ${jobId} cancelled. Stopping.`);
      await agentJobTracker.completeJob(jobId, {
        message: `Stopped after finding contacts for ${completedCount} leads.`,
        processed: completedCount,
      });
      return;
    }

    await Promise.all(
      chunk.map(async (leadId) => {
        try {
          const lead = await storage.getInternalLead(leadId);
          if (!lead) return;

          await agentJobTracker.updateProgress(
            jobId,
            `Finding contacts for ${lead.companyName}...`,
            completedCount,
            `Searching ${lead.companyName}`
          );

          const contacts = await findContacts(lead);

          // Update lead with found contacts
          const contactsForSchema = contacts.map((c) => ({
            name: c.name,
            role: c.role,
            email: c.email,
            phone: c.phone,
            linkedinUrl: c.linkedinUrl,
          }));

          const bestContact = contacts.find((c) => c.email) || contacts[0];

          await storage.updateInternalLead(leadId, {
            contacts: contactsForSchema.length > 0 ? contactsForSchema : lead.contacts,
            contactName: bestContact?.name || lead.contactName,
            email: bestContact?.email || lead.email,
            phone: bestContact?.phone || lead.phone,
            linkedinUrl: bestContact?.linkedinUrl || lead.linkedinUrl,
          });

          await agentJobTracker.updateProgress(
            jobId,
            `Found ${contacts.length} contacts for ${lead.companyName}`,
            completedCount + 1,
            `${contacts.filter((c) => c.email).length} with email`,
            "success"
          );
          completedCount++;
        } catch (error) {
          console.error(`[ContactFinder] Failed for lead ${leadId}:`, error);
          await agentJobTracker.updateProgress(jobId, "Error", completedCount, `Failed ${leadId}`, "error");
        }
      })
    );

    // Rate limit between batches
    await new Promise((r) => setTimeout(r, 1000));
  }

  await agentJobTracker.completeJob(jobId, {
    message: `Found contacts for ${completedCount} leads.`,
    processed: completedCount,
  });
}
