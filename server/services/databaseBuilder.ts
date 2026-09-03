import { storage } from "../storage";
import { InternalLead, InsertInternalLead, BrokerLead, InsertBrokerLead } from "../../shared/schema";
import { excludedSectorReason, isBrokerProspect, classifyProspectStream } from "@shared/salesOs";

export interface DiscoveryTarget {
    location?: string;    // e.g. "Leicester" or "Leicestershire"
    postcode?: string;   // e.g. "LE" (secondary strict filter)
    sicCodes?: string[]; // e.g. ["64921", "64922"]
}

export class DatabaseBuilderService {
    private readonly apiKey = process.env.COMPANIES_HOUSE_API_KEY;

    async runDiscoveryLoop(
        targets: DiscoveryTarget[] = [
            { location: "Leicester", postcode: "LE" },
            { location: "Nottingham", postcode: "NG" },
            { location: "Derby", postcode: "DE" },
            { location: "Lincoln", postcode: "LN" }
        ],
        options: { autoEnrich?: boolean, userId?: string, leadType?: 'internal' | 'broker' } = {}
    ) {
        const { agentJobTracker } = await import("./agentJobTracker");
        let jobId: string | undefined;

        if (options.userId) {
            jobId = await agentJobTracker.createJob(
                "database-builder",
                options.userId,
                "scheduled_task",
                "Regional Discovery Project",
                `Searching for active companies in ${targets.length} locations.`,
                targets.length
            );
        }

        console.log(`[Database Builder] Starting discovery loop for: ${targets.map(t => t.location || t.sicCodes?.join(",")).join(", ")}... (Auto-Enrich: ${!!options.autoEnrich})`);

        const newLeadIds: number[] = [];

        if (!this.apiKey) {
            const errorMsg = "COMPANIES_HOUSE_API_KEY not configured";
            console.error(`[Database Builder] ${errorMsg}`);
            if (jobId) await agentJobTracker.failJob(jobId, errorMsg);
            return [];
        }

        const base64Auth = Buffer.from(`${this.apiKey.trim()}:`).toString("base64");

        let completedTargets = 0;
        for (const target of targets) {
            if (jobId) {
                const currentJob = await agentJobTracker.getJob(jobId);
                if (!currentJob || currentJob.status !== "running") {
                    console.log(`[Database Builder] Job ${jobId} is no longer running. Stopping discovery.`);
                    await agentJobTracker.completeJob(jobId, {
                        newLeadsCount: newLeadIds.length,
                        locationsSearched: completedTargets,
                    });
                    return newLeadIds;
                }
            }
            try {
                const targetName = target.location || (target.sicCodes ? `SIC: ${target.sicCodes.join(",")}` : "Unknown");
                console.log(`[Database Builder] Searching: ${targetName} (Target PC: ${target.postcode || "None"})`);

                if (jobId) {
                    await agentJobTracker.updateProgress(
                        jobId,
                        `Searching ${targetName}...`,
                        completedTargets,
                        `Beginning search for ${targetName}`
                    );
                }

                // Scan more pages for broad searches
                const pagesToScan = 5; // Reduced default to be faster for user demo, was 10

                for (let page = 0; page < pagesToScan; page++) {
                    const params = new URLSearchParams({
                        company_status: "active",
                        company_type: "ltd",
                        size: "100",
                        start_index: (page * 100).toString(),
                    });

                    if (target.location) params.set("location", target.location);
                    if (target.sicCodes && target.sicCodes.length > 0) {
                        params.set("sic_codes", target.sicCodes.join(","));
                    }

                    const url = `https://api.company-information.service.gov.uk/advanced-search/companies?${params.toString()}`;
                    const response = await fetch(url, {
                        headers: { Authorization: `Basic ${base64Auth}` },
                    });

                    if (!response.ok) {
                        console.error(`[Database Builder] API error for ${targetName} page ${page}: ${response.status}`);
                        if (jobId) await agentJobTracker.updateProgress(jobId, `Error on ${targetName}`, completedTargets, `Companies House API error: ${response.status}`, "warning");
                        break;
                    }

                    const data = await response.json();
                    const items = data.items || [];
                    console.log(`[Database Builder] Page ${page}: Received ${items.length} items for ${targetName}`);

                    let pageNewLeadsCount = 0;
                    let skippedCount = 0;
                    for (const item of items) {
                        const addr = item.registered_office_address;
                        const itemSicCodes = item.sic_codes || [];

                        // 0. Strict SIC Code Check
                        if (target.sicCodes && target.sicCodes.length > 0) {
                            const hasMatchingSic = target.sicCodes.some(code => itemSicCodes.includes(code));
                            if (!hasMatchingSic) {
                                skippedCount++;
                                continue;
                            }
                        }

                        // 1. Strict Geolocation Check
                        if (target.postcode) {
                            const pc = (addr?.postal_code || "").toUpperCase().replace(/\s+/g, "");
                            if (!pc.startsWith(target.postcode.toUpperCase())) {
                                skippedCount++;
                                continue;
                            }
                        }

                        if (isBrokerProspect(item.company_name, itemSicCodes)) {
                            skippedCount++;
                            continue;
                        }
                        if (excludedSectorReason(itemSicCodes, item.company_name)) {
                            skippedCount++;
                            continue;
                        }

                        // 2. Secondary "Strong Match" check
                        const fullAddrString = [
                            addr?.premises,
                            addr?.address_line_1,
                            addr?.address_line_2,
                            addr?.locality,
                            addr?.region,
                            addr?.postal_code
                        ].join(" ").toLowerCase();

                        if (target.location && !fullAddrString.includes(target.location.toLowerCase())) {
                            skippedCount++;
                            continue;
                        }

                        // 3. Deduplicate
                        // Introducer-shaped companies (accountants, CFOs, turnaround advisers) always
                        // route to the broker/introducer pipeline, regardless of which caller kicked
                        // off this discovery run — the autonomous scheduler never sets leadType, and
                        // was silently dumping them into the direct-borrower pipeline.
                        const isIntroducer = classifyProspectStream({
                            companyName: item.company_name,
                            sicCodes: itemSicCodes,
                        }).stream === "introducer";
                        const leadType = isIntroducer ? 'broker' : (options.leadType || 'internal');
                        const existing = leadType === 'broker'
                            ? await storage.getBrokerLeadByCompanyNumber(item.company_number)
                            : await storage.getInternalLeadByCompanyNumber(item.company_number);
                        if (existing) continue;

                        // 4. Charge Check
                        let hasCharges = false;
                        try {
                            const profileUrl = `https://api.company-information.service.gov.uk/company/${item.company_number}`;
                            const profileRes = await fetch(profileUrl, {
                                headers: { Authorization: `Basic ${base64Auth}` },
                            });

                            if (profileRes.status === 429) {
                                console.warn("[Database Builder] Rate limit hit (429). Waiting 30s...");
                                await new Promise(r => setTimeout(r, 30000));
                                const retryRes = await fetch(profileUrl, {
                                    headers: { Authorization: `Basic ${base64Auth}` },
                                });
                                if (retryRes.ok) {
                                    const profileData = await retryRes.json();
                                    hasCharges = !!profileData.links?.charges;
                                }
                            } else if (profileRes.ok) {
                                const profileData = await profileRes.json();
                                hasCharges = !!profileData.links?.charges;
                            }
                        } catch (err) {
                            console.warn(`[Database Builder] Failed to fetch profile for ${item.company_number}:`, err);
                        }

                        let pc = addr?.postal_code || "";
                        if (pc) {
                            const raw = pc.replace(/[^A-Z0-9]/ig, '').toUpperCase();
                            pc = raw.length > 3 ? `${raw.slice(0, -3)} ${raw.slice(-3)}` : raw;
                        }

                        const fullAddressFormatted = [
                            addr?.premises,
                            addr?.address_line_1,
                            addr?.address_line_2,
                            addr?.locality,
                            addr?.region,
                            pc,
                            addr?.country,
                        ]
                            .filter(Boolean)
                            .join(", ");

                        if (leadType === 'broker') {
                            const lead: InsertBrokerLead = {
                                companyName: item.company_name,
                                companyNumber: item.company_number,
                                status: "new",
                                address: fullAddressFormatted,
                                city: target.location || (addr?.locality || ""),
                                hasCharges: hasCharges,
                                totalChargesCount: 0,
                                satisfiedChargesCount: 0,
                                sicCode: item.sic_codes ? item.sic_codes[0] : undefined,
                                contacts: [],
                                commissionRate: 0.1,
                                possibleDuplicate: false,
                                notes: `Discovered by Broker Agent (Target: ${target.location || "Anywhere"}${target.sicCodes ? `, SIC: ${target.sicCodes.join(",")}` : ""}). ${hasCharges ? "Registered charges found." : "No registered charges."}`,
                            };
                            const created = await storage.createBrokerLead(lead);
                            newLeadIds.push(created.id);
                        } else {
                            const lead: InsertInternalLead = {
                                companyName: item.company_name,
                                companyNumber: item.company_number,
                                status: "new",
                                address: fullAddressFormatted,
                                city: target.location || (addr?.locality || ""),
                                hasCharges: hasCharges,
                                totalChargesCount: 0,
                                satisfiedChargesCount: 0,
                                companyType: item.company_type,
                                sicCode: item.sic_codes ? item.sic_codes[0] : undefined,
                                incorporationDate: item.date_of_creation,
                                contacts: [],
                                commissionRate: 0.1,
                                possibleDuplicate: false,
                                notes: `Discovered by Database Builder (Target: ${target.location || "Anywhere"}${target.sicCodes ? `, SIC: ${target.sicCodes.join(",")}` : ""}). ${hasCharges ? "Registered charges found." : "No registered charges."}`,
                            };

                            const created = await storage.createInternalLead(lead);
                            newLeadIds.push(created.id);
                        }
                        pageNewLeadsCount++;

                        await new Promise((resolve) => setTimeout(resolve, 200));
                    }

                    if (jobId && pageNewLeadsCount > 0) {
                        await agentJobTracker.updateProgress(
                            jobId,
                            `Searching ${targetName}...`,
                            completedTargets,
                            `Found ${pageNewLeadsCount} new leads in ${targetName} (Page ${page})`,
                            "success"
                        );
                    }

                    console.log(`[Database Builder] Page ${page}: Added ${pageNewLeadsCount} new leads (Skipped ${skippedCount} non-matching items)`);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    if (items.length < 50) break;
                }

                completedTargets++;
            } catch (error: any) {
                console.error(`[Database Builder] Error processing ${target.location}:`, error);
                if (jobId) await agentJobTracker.updateProgress(jobId, "Error", completedTargets, `Error processing ${target.location}: ${error.message}`, "error");
                completedTargets++;
            }
        }

        console.log(`[Database Builder] Discovery loop complete. Found ${newLeadIds.length} leads.`);

        if (jobId) {
            await agentJobTracker.completeJob(jobId, {
                newLeadsCount: newLeadIds.length,
                locationsSearched: targets.length
            });
        }

        if (options.autoEnrich && newLeadIds.length > 0) {
            console.log(`[Database Builder] Triggering auto-enrichment for ${newLeadIds.length} leads...`);
            const { enrichLeadsInBackground } = await import("./leadEnrichmentService");
            enrichLeadsInBackground(newLeadIds, options.userId).catch(err => {
                console.error("[Database Builder] Background enrichment failed:", err);
            });
        }

        return newLeadIds;
    }
}

export const databaseBuilderService = new DatabaseBuilderService();
