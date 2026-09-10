import { emptySlots, hydrateBulletsFromMarkdown, SLOT_CAPS } from "@shared/proposalFacts";
import { storage } from "../storage";
import { buildCreditFileContext } from "./creditFileContext";
import { generateCampariSection } from "./geminiClient";
import type { ProspectReportData } from "./pdfGenerator";

export async function ensureBackground(data: ProspectReportData): Promise<ProspectReportData> {
  try {
    const prospect = data.prospect;
    const fileFacts = buildCreditFileContext({
      prospect,
      dueDiligence: (data.dueDiligence?.data || {}) as Record<string, any>,
      contacts: data.contacts,
    });
    const content = await generateCampariSection(
      "background",
      prospect.company?.companyName,
      prospect.company?.sicDescription || "",
      undefined,
      prospect.loanRequirementNotes || "",
      "",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      fileFacts,
    );
    const bullets = hydrateBulletsFromMarkdown(
      content,
      SLOT_CAPS.background.cap,
      SLOT_CAPS.background.maxWords,
    );
    if (!bullets.length) return data;
    const next = attachBackground(data, bullets);
    await persistBackground(next, bullets);
    return next;
  } catch {
    return data;
  }
}

function attachBackground(data: ProspectReportData, bullets: string[]): ProspectReportData {
  const dueDiligence = data.dueDiligence || { data: {} };
  const existingData = (dueDiligence.data || {}) as Record<string, any>;
  const proposal = { ...(existingData.proposal || {}) };
  const existingSlots = (proposal.slots || {}) as Record<string, any>;
  proposal.slots = {
    ...emptySlots(),
    ...existingSlots,
    campari: { ...emptySlots().campari, ...(existingSlots.campari || {}) },
    swot: { ...emptySlots().swot, ...(existingSlots.swot || {}) },
    background: bullets,
  };
  return {
    ...data,
    dueDiligence: { ...dueDiligence, data: { ...existingData, proposal } } as ProspectReportData["dueDiligence"],
  };
}

async function persistBackground(data: ProspectReportData, bullets: string[]): Promise<void> {
  const prospectId = data.prospect?.id;
  const userId = data.prospect?.userId;
  if (!prospectId || !userId) return;
  const existing = await storage.getDueDiligence(prospectId, userId);
  const existingData = (existing?.data || {}) as Record<string, any>;
  const proposal = { ...(existingData.proposal || {}) };
  const existingSlots = (proposal.slots || {}) as Record<string, any>;
  proposal.slots = {
    ...emptySlots(),
    ...existingSlots,
    campari: { ...emptySlots().campari, ...(existingSlots.campari || {}) },
    swot: { ...emptySlots().swot, ...(existingSlots.swot || {}) },
    background: bullets,
  };
  await storage.upsertDueDiligence(prospectId, userId, { ...existingData, proposal } as any);
}
