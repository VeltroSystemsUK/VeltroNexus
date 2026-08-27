import { storage } from "../storage";

const FAR_EXPIRY = "2099-01-01T00:00:00.000Z";
const FINISHED = new Set(["approved", "declined", "withdrawn"]);

export function canCreateOrReopenUnderwriting(opts: {
  submissionStatus?: string | null;
  handoffStatus?: string | null;
}): "create" | "reopen" | "blocked" {
  if (!opts.submissionStatus || FINISHED.has(opts.submissionStatus)) return "create";
  if (opts.submissionStatus === "returned" || opts.handoffStatus === "returned") return "reopen";
  return "blocked";
}

export async function ensureSterlingHandoff(opts: {
  prospectId: number;
  userId: string;
  submissionId?: number;
}): Promise<{ ok: boolean; reason?: string; handoff?: any }> {
  const partnerEmail = process.env.BROKER_HANDOFF_EMAIL;
  if (!partnerEmail) return { ok: false, reason: "Sterling portal not configured" };

  const partner = await storage.getUserByEmail(partnerEmail);
  if (!partner || partner.role !== "external_broker") {
    return { ok: false, reason: "Sterling portal not configured" };
  }

  const existing = await storage.getBrokerHandoffByProspect(opts.prospectId);
  if (existing?.status === "sent") {
    return { ok: true, handoff: existing };
  }

  const found = opts.submissionId
    ? undefined
    : await storage.getUnderwritingSubmissionByProspect(opts.prospectId);
  const submissionId = opts.submissionId ?? found?.id ?? 0;

  if (existing) {
    const updates: Record<string, unknown> = { submissionId };
    if (existing.status === "returned") updates.status = "awaiting_recommendation";
    const handoff = await storage.updateBrokerHandoff(existing.id, updates);
    return { ok: true, handoff };
  }

  const handoff = await storage.createBrokerHandoff({
    submissionId,
    prospectId: opts.prospectId,
    externalUserId: partner.id,
    sentByUserId: opts.userId,
    expiresAt: FAR_EXPIRY,
    status: "awaiting_recommendation",
  });
  return { ok: true, handoff };
}

export async function markSterlingReturned(opts: {
  handoff: { id: number; prospectId?: number | null; submissionId?: number | null };
  note: string;
  userId: string;
}) {
  const updated = await storage.updateBrokerHandoff(opts.handoff.id, {
    status: "returned",
    returnNote: opts.note,
    returnedAt: new Date().toISOString(),
  });
  if (opts.handoff.prospectId) {
    const prospect = await storage.getProspectById(opts.handoff.prospectId);
    if (prospect?.userId) {
      await storage.updateProspectStage(prospect.id, prospect.userId, "further-information");
    }
  }
  if (opts.handoff.submissionId) {
    await storage.updateUnderwritingSubmission(opts.handoff.submissionId, {
      status: "returned",
      decisionReason: opts.note,
    });
    await storage.createUnderwritingActivity(
      {
        submissionId: opts.handoff.submissionId,
        activityType: "returned_from_sterling",
        content: `Returned from Sterling: ${opts.note}`,
      },
      opts.userId,
    );
  }
  return updated;
}
