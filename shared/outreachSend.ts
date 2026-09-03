export type CadenceAfterOutreach =
  | "advance"
  | "hold_undelivered"
  | "hold_linkedin"
  | "hold_pecr"
  | "hold_approval";

export function wasEmailDelivered(result?: { success?: boolean; mock?: boolean; messageId?: string } | null): boolean {
  if (!result) return false;
  if (result.mock) return false;
  return result.success === true;
}

export function cadenceAfterOutreach(opts: {
  autoSend: boolean;
  isLinkedIn: boolean;
  delivered: boolean;
  blockReason?: string | null;
  requireApproval?: boolean;
  approved?: boolean;
}): CadenceAfterOutreach {
  if (opts.blockReason) return "hold_pecr";
  if (opts.isLinkedIn) return "hold_linkedin";
  if (opts.requireApproval && !opts.approved) return "hold_approval";
  if (opts.autoSend && !opts.delivered) return "hold_undelivered";
  return "advance";
}
