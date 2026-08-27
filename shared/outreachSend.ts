export type CadenceAfterOutreach =
  | "advance"
  | "hold_undelivered"
  | "hold_linkedin"
  | "hold_pecr";

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
}): CadenceAfterOutreach {
  if (opts.blockReason) return "hold_pecr";
  if (opts.isLinkedIn) return "hold_linkedin";
  if (opts.autoSend && !opts.delivered) return "hold_undelivered";
  return "advance";
}
