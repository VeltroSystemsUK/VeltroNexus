export const HARVEST_GUESS_SAMPLE = 50;
export const HARVEST_GUESS_BOUNCE_TRIP = 8;

export type GuessedSendRow = {
  to: string;
  status: string;
  contactSource?: string;
  createdAt?: string;
};

export function guessedSendSample<T extends GuessedSendRow>(
  items: T[],
  opts?: { after?: string }
): T[] {
  const after = opts?.after;
  return items
    .filter((item) => item.contactSource === "domain" && (item.status === "sent" || item.status === "mock"))
    .filter((item) => !after || String(item.createdAt || "") > after)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, HARVEST_GUESS_SAMPLE);
}

export function shouldTripGuessPause(
  sample: Array<{ to: string }>,
  suppressedEmails: Set<string>
): boolean {
  if (sample.length < HARVEST_GUESS_SAMPLE) return false;
  const bounced = sample.filter((item) => suppressedEmails.has(String(item.to || "").toLowerCase())).length;
  return bounced >= HARVEST_GUESS_BOUNCE_TRIP;
}
