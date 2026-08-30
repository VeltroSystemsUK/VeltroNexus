import { InternalLead, BrokerLead } from "../../shared/schema";
import { searchCompanyInfo } from "../utils/geminiClient";

export interface EnrichmentResult {
    emails: string[];
    phones: string[];
    contacts: Array<{
        name?: string;
        role?: string;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
    }>;
    website?: string;
    linkedinUrl?: string; // Company LinkedIn Page
    businessOverview?: string;
    sources: Array<{ url: string; title: string }>;
    identifiedLender?: string;
    chargeDate?: string;
    chargeAmount?: number;
    chargeStatus?: string;
    totalChargesCount?: number;
    satisfiedChargesCount?: number;
}

/**
 * Fetch charge details from Companies House with detailed status
 */
async function fetchChargeDetails(companyNumber: string): Promise<{
    identifiedLender?: string;
    chargeDate?: string;
    chargeAmount?: number;
    chargeStatus?: string;
    totalChargesCount?: number;
    satisfiedChargesCount?: number;
}> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) return {};

    try {
        const base64Auth = Buffer.from(`${apiKey.trim()}:`).toString("base64");
        const url = `https://api.company-information.service.gov.uk/company/${companyNumber}/charges`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        let response;
        try {
            response = await fetch(url, {
                headers: { Authorization: `Basic ${base64Auth}` },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            console.warn(`[Agent B] Companies House API error: ${response.status} for ${companyNumber}`);
            return {};
        }

        const data: any = await response.json();
        const charges = data.items || [];
        const totalCount = charges.length;

        if (totalCount === 0) return { chargeStatus: 'none', totalChargesCount: 0, satisfiedChargesCount: 0 };

        const satisfiedCount = charges.filter((c: any) => c.status === 'satisfied' || c.status === 'fully-satisfied').length;

        // Filter for active (not satisfied) charges and sort by date descending
        const activeCharges = charges
            .filter((c: any) => c.status !== 'satisfied' && c.status !== 'fully-satisfied')
            .sort((a: any, b: any) => {
                const dateA = new Date(a.delivered_on || a.created_on || 0).getTime();
                const dateB = new Date(b.delivered_on || b.created_on || 0).getTime();
                return dateB - dateA;
            });

        let latestCharge = activeCharges.length > 0 ? activeCharges[0] : null;
        let status = activeCharges.length > 0 ? 'active' : 'satisfied';

        // If no active charges, find the most recent satisfied one to show the former lender
        if (!latestCharge && charges.length > 0) {
            const sortedAll = [...charges].sort((a: any, b: any) => {
                const dateA = new Date(a.delivered_on || a.created_on || 0).getTime();
                const dateB = new Date(b.delivered_on || b.created_on || 0).getTime();
                return dateB - dateA;
            });
            latestCharge = sortedAll[0];
        }

        const lenders = latestCharge?.persons_entitled?.map((p: any) => p.name).filter(Boolean).join(", ");

        console.log(`[Agent B] Found charge history for ${companyNumber}: ${status} (${satisfiedCount}/${totalCount} satisfied)`);

        return {
            identifiedLender: lenders || (status === 'active' ? "Unknown Lender" : "Former Lender Not Found"),
            chargeDate: latestCharge?.delivered_on || latestCharge?.created_on,
            chargeAmount: undefined,
            chargeStatus: status,
            totalChargesCount: totalCount,
            satisfiedChargesCount: satisfiedCount
        };
    } catch (error) {
        console.warn(`[Agent B] Failed to fetch charges for ${companyNumber}:`, error);
        return {};
    }
}

/**
 * Enrich a single lead using Gemini Grounded Search
 */
export async function enrichLead(lead: InternalLead | BrokerLead): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
        emails: [],
        phones: [],
        contacts: [],
        sources: [],
        website: lead.website
    };

    console.log(`[Agent B] Enriching ${lead.companyName} (Lead ID: ${lead.id})`);

    // Step 1: Companies House Charge Data (Official Source)
    try {
        if (lead.companyNumber) {
            const chargeDetails = await fetchChargeDetails(lead.companyNumber);
            result.identifiedLender = chargeDetails.identifiedLender;
            result.chargeDate = chargeDetails.chargeDate;
            result.chargeStatus = chargeDetails.chargeStatus;
            result.totalChargesCount = chargeDetails.totalChargesCount;
            result.satisfiedChargesCount = chargeDetails.satisfiedChargesCount;
        }
    } catch (error) {
        console.error("[Agent B] Companies House lookup failed:", error);
    }

    // Step 2: Gemini Grounded Search (Replaces Tavily)
    // Runs in parallel with Companies House if we structured it that way, but sequential is safer for logic flow
    try {
        console.log(`[Agent B] Asking Gemini to research ${lead.companyName}...`);
        const geminiData = await searchCompanyInfo(lead.companyName, lead.website);

        result.businessOverview = geminiData.businessOverview;
        result.emails.push(...(geminiData.emails || []));
        result.phones.push(...(geminiData.phones || []));
        result.linkedinUrl = geminiData.linkedinUrls?.[0];

        if (geminiData.contacts) {
            result.contacts = geminiData.contacts.map(c => ({
                name: c.name,
                role: c.role,
                email: c.email
            }));
        }

        if (geminiData.sources) {
            result.sources = geminiData.sources;
        }

    } catch (error) {
        console.warn("[Agent B] Gemini enrichment failed:", error);
    }

    // Deduplicate emails/phones
    result.emails = Array.from(new Set(result.emails)).filter(Boolean);
    result.phones = Array.from(new Set(result.phones)).filter(Boolean);

    return result;
}

/**
 * Enrich multiple leads in the background with BATCH PROCESSING
 */
export async function enrichLeadsInBackground(
    leadIds: number[],
    userId?: string,
    leadType: "internal" | "broker" = "internal"
): Promise<void> {
    const { agentJobTracker } = await import("./agentJobTracker");
    let jobId: string | undefined;

    if (userId) {
        jobId = await agentJobTracker.createJob(
            "enrichment-agent",
            userId,
            "data_enrichment",
            "Bulk Lead Enrichment",
            `Enriching ${leadIds.length} leads using Gemini Grounded Search`,
            leadIds.length
        );
    }

    console.log(`[Agent B] Starting fast batch enrichment for ${leadIds.length} leads`);
    const { storage } = await import("../storage");
    const getLead = leadType === "broker"
        ? storage.getBrokerLead.bind(storage)
        : storage.getInternalLead.bind(storage);
    const updateLead = leadType === "broker"
        ? storage.updateBrokerLead.bind(storage)
        : storage.updateInternalLead.bind(storage);

    // Process in batches of 5 to respect concurrency limits but speed up speed
    const BATCH_SIZE = 5;

    // Split into chunks
    const chunks = [];
    for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        chunks.push(leadIds.slice(i, i + BATCH_SIZE));
    }

    let completedCount = 0;

    for (const chunk of chunks) {
        // Check if job was cancelled/stopped
        if (jobId) {
            const currentJob = await agentJobTracker.getJob(jobId);
            if (!currentJob || currentJob.status !== "running") {
                console.log(`[Agent B] Job ${jobId} is no longer running (Status: ${currentJob?.status}). Stopping enrichment.`);
                return;
            }
        }

        // Process chunk in parallel
        await Promise.all(chunk.map(async (leadId) => {
            try {
                const lead = await getLead(leadId);
                if (!lead) return;

                if (jobId) {
                    await agentJobTracker.updateProgress(
                        jobId,
                        `Enriching ${lead.companyName}...`,
                        completedCount,
                        `Processing ${lead.companyName}`
                    );
                }

                const enrichmentResult = await enrichLead(lead);

                await updateLead(leadId, {
                    email: enrichmentResult.emails[0] || lead.email,
                    phone: enrichmentResult.phones[0] || lead.phone,
                    contactName: enrichmentResult.contacts[0]?.name || (lead as any).contactName,
                    linkedinUrl: enrichmentResult.linkedinUrl || lead.linkedinUrl,
                    identifiedLender: enrichmentResult.identifiedLender || lead.identifiedLender,
                    chargeDate: enrichmentResult.chargeDate || lead.chargeDate,
                    chargeStatus: enrichmentResult.chargeStatus || lead.chargeStatus,
                    totalChargesCount: enrichmentResult.totalChargesCount ?? lead.totalChargesCount,
                    satisfiedChargesCount: enrichmentResult.satisfiedChargesCount ?? lead.satisfiedChargesCount,
                    contacts: enrichmentResult.contacts.length > 0 ? enrichmentResult.contacts : lead.contacts,
                    notes: `[GEMINI ENRICHMENT - ${new Date().toLocaleDateString()}]
Lender: ${enrichmentResult.identifiedLender || 'Not Found'}
Status: ${enrichmentResult.chargeStatus ? enrichmentResult.chargeStatus.toUpperCase() : 'Unknown'}
${enrichmentResult.businessOverview || ''}

${lead.notes || ''}`
                });

                if (jobId) {
                    await agentJobTracker.updateProgress(
                        jobId,
                        `Processed ${lead.companyName}`,
                        completedCount + 1,
                        `Enriched ${lead.companyName}`,
                        "success"
                    );
                }
                completedCount++;
            } catch (error) {
                console.error(`[Agent B] Failed to enrichment lead ${leadId}:`, error);
                if (jobId) {
                    await agentJobTracker.updateProgress(jobId, "Error", completedCount, `Failed ${leadId}`, "error");
                }
            }
        }));
    }

    if (jobId) {
        await agentJobTracker.completeJob(jobId, {
            message: `Successfully enriched ${completedCount} leads using Gemini.`,
            processed: completedCount
        });
    }
}
