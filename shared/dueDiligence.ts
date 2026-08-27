import type { DueDiligenceData } from "./schema";

/** GET /due-diligence returns the DB row `{ prospectId, userId, data }`. Inner-only payloads also exist. */
export function unwrapDueDiligence(raw: unknown): DueDiligenceData {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const inner = record.data;
  const isRow =
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    ("prospectId" in record || "userId" in record);
  if (isRow) return inner as DueDiligenceData;
  return record as DueDiligenceData;
}
