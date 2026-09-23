import { applyMailboxToCrmLead } from "@shared/crmLeadContact";
import { storage } from "../storage";
import { listAgentMail } from "./agentMailLog";

export async function writeMailboxToClients(opts: {
  companyNumber?: string | null;
  email?: string | null;
  contactName?: string | null;
}): Promise<boolean> {
  const companyNumber = String(opts.companyNumber || "").trim();
  if (!companyNumber) return false;
  const lead = await storage.getInternalLeadByCompanyNumber(companyNumber);
  if (!lead) return false;
  const next = applyMailboxToCrmLead(lead, { email: opts.email, contactName: opts.contactName });
  if (!next.changed) return false;
  await storage.updateInternalLead(lead.id, {
    email: next.email,
    ...(next.contactName ? { contactName: next.contactName } : {}),
    contacts: next.contacts,
  });
  return true;
}

export async function writeMailboxToClientsFromDeal(
  dealId: number | undefined,
  email?: string | null,
): Promise<boolean> {
  if (!dealId) return false;
  const deal = await storage.getAgenticDeal(dealId);
  if (!deal) return false;
  return writeMailboxToClients({
    companyNumber: deal.companyNumber,
    email: email || deal.email,
    contactName: deal.contactName,
  });
}

export async function backfillClientMailboxesFromMail(): Promise<{ scanned: number; updated: number }> {
  const mail = listAgentMail(10_000).filter(
    (item) =>
      item.direction === "outbound" &&
      (item.status === "sent" || item.status === "mock") &&
      item.dealId,
  );
  const [deals, leads] = await Promise.all([storage.listAgenticDeals(), storage.listInternalLeads()]);
  const dealsById = new Map(deals.map((deal) => [Number(deal.id), deal]));
  const working = new Map(
    leads
      .filter((lead) => String(lead.companyNumber || "").trim())
      .map((lead) => [String(lead.companyNumber).trim().toLowerCase(), { ...lead }]),
  );
  const dirty = new Set<number>();
  let scanned = 0;
  for (const item of mail) {
    const deal = dealsById.get(Number(item.dealId));
    const number = String(deal?.companyNumber || "").trim().toLowerCase();
    if (!number) continue;
    const lead = working.get(number);
    if (!lead) continue;
    scanned += 1;
    const next = applyMailboxToCrmLead(lead, { email: item.to, contactName: deal?.contactName });
    if (!next.changed) continue;
    const merged = {
      ...lead,
      email: next.email,
      ...(next.contactName ? { contactName: next.contactName } : {}),
      contacts: next.contacts,
    };
    working.set(number, merged);
    dirty.add(lead.id);
  }
  let updated = 0;
  const byId = new Map([...working.values()].map((lead) => [lead.id, lead]));
  for (const id of dirty) {
    const lead = byId.get(id);
    if (!lead) continue;
    await storage.updateInternalLead(id, {
      email: lead.email,
      ...(lead.contactName ? { contactName: lead.contactName } : {}),
      contacts: lead.contacts || [],
    });
    updated += 1;
  }
  return { scanned, updated };
}
