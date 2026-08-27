import type { InternalLead } from "@shared/schema";
import { storage } from "../storage";

const DEFAULT_OWNER_EMAIL = "shaun@veltro.co.uk";

export function isInboundLead(lead: {
  assignedAgentId?: string | null;
  companyNumber?: string | null;
}): boolean {
  return lead.assignedAgentId === "capital-strategist" || String(lead.companyNumber || "").startsWith("WEB-");
}

export function inboundLoanAmountPence(lead: Pick<InternalLead, "notes">): number | null {
  try {
    const notes = JSON.parse(String(lead.notes || "{}"));
    const debt = Number(notes?.calculatorData?.currentDebt);
    if (Number.isFinite(debt) && debt > 0) return Math.round(debt * 100);
  } catch {
    // notes are free text on some CRM leads
  }
  return null;
}

export async function resolvePipelineOwnerUserId(): Promise<string> {
  const configured = (process.env.INBOUND_OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  const users = await storage.getAllUsers();
  const match = users.find((user) => (user.email || "").toLowerCase() === configured);
  if (match) return match.id;
  const admin = users.find((user) => user.role === "super_admin");
  if (admin) return admin.id;
  if (users[0]) return users[0].id;
  throw new Error("No pipeline owner user available");
}

export async function promoteInternalLeadToPipeline(
  lead: InternalLead,
  ownerUserId?: string
): Promise<{ prospectId: number; created: boolean }> {
  if (!lead.id) throw new Error("Lead is missing an id");

  const userId = ownerUserId || (await resolvePipelineOwnerUserId());
  const inbound = isInboundLead(lead);
  const companyNumber = lead.companyNumber || `WEB-${lead.id}`;

  let company = await storage.getCompanyByNumber(companyNumber);
  if (!company) {
    company = await storage.createCompany({
      companyName: lead.companyName,
      companyNumber,
      registeredAddress: lead.address || "",
      companyType: lead.companyType || "ltd",
      sicCode: lead.sicCode || undefined,
      incorporationDate: lead.incorporationDate || undefined,
      companyStatus: "active",
    });
  }

  const existing = (await storage.listProspects(userId)).find((row) => row.companyId === company!.id);
  if (existing?.id) {
    if (lead.status !== "converted") {
      await storage.updateInternalLead(lead.id, { status: "converted" });
    }
    return { prospectId: existing.id, created: false };
  }

  const loanAmount = inboundLoanAmountPence(lead);

  const prospect = await storage.createProspect(
    {
      companyId: company.id!,
      stage: "lead",
      referralSource: inbound ? "Strata" : "discovery",
      priority: inbound ? "high" : "medium",
      notes: inbound
        ? [
            "Inbound from stratafinance.co.uk.",
            `Contact: ${lead.contactName || "Unknown"}`,
            `Email: ${lead.email || "N/A"}`,
            `Phone: ${lead.phone || "N/A"}`,
            `Internal lead #${lead.id}`,
            "",
            lead.notes || "",
          ].join("\n")
        : `Promoted from Internal Lead DB. Discovered in: ${lead.city || "n/a"}${lead.hasCharges ? " (Has Registered Charges)" : ""}\n\nOriginal Notes: ${lead.notes || "None"}`,
      loanAmount: loanAmount ?? Number(lead.estimatedValue || 0),
      directorsGuarantee: 0,
      commercialProperty: 0,
      homeEquity: 0,
      propertyOther: 0,
      debenture: 0,
      parentCompanyGuarantee: 0,
      collateral: 0,
      crossCompanyGuarantee: 0,
      queueOrder: 0,
    },
    userId
  );

  if (!prospect.id) throw new Error("Failed to create pipeline prospect");

  if (lead.contactName || lead.email || lead.phone) {
    await storage.createContact(
      {
        prospectId: prospect.id,
        name: lead.contactName || lead.companyName,
        email: lead.email || null,
        phone: lead.phone || null,
        role: "Director",
        isPrimary: 1,
      },
      userId
    );
  }

  await storage.updateInternalLead(lead.id, { status: "converted" });
  return { prospectId: prospect.id, created: true };
}

export async function promoteOpenInboundLeadsToPipeline(): Promise<{
  prospectId: number;
  created: boolean;
  leadId: number;
}[]> {
  const ownerUserId = await resolvePipelineOwnerUserId();
  const inbound = (await storage.listInternalLeads()).filter(isInboundLead);
  const results = [];
  for (const lead of inbound) {
    const promoted = await promoteInternalLeadToPipeline(lead, ownerUserId);
    results.push({ ...promoted, leadId: lead.id! });
  }
  return results;
}
