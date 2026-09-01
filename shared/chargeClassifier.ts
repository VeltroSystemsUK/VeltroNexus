const BANK_NEEDLES = [
  "HSBC",
  "NATWEST",
  "NATIONAL WESTMINSTER",
  "ROYAL BANK OF SCOTLAND",
  "RBS ",
  "LLOYDS",
  "BANK OF SCOTLAND",
  "HALIFAX",
  "BARCLAYS",
  "SANTANDER",
  "NATIONWIDE",
  "TSB BANK",
  "TSB ",
  "HANDELSBANKEN",
  "CLYDESDALE",
  "YORKSHIRE BANK",
  "METRO BANK",
  "VIRGIN MONEY",
  "AIB",
  "BANK OF IRELAND",
  "ALLIED IRISH",
  "DANSKE",
  "ULSTER BANK",
  "CO-OPERATIVE BANK",
  "COOPERATIVE BANK",
];

function norm(name: string): string {
  return String(name || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isBankOrBuildingSocietyChargee(name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return BANK_NEEDLES.some((needle) => n.includes(needle));
}

export function isLiveCharge(status?: string | null): boolean {
  const s = String(status || "").toLowerCase();
  if (!s) return true;
  return !s.includes("satisfied") && !s.includes("released") && s !== "fully-satisfied";
}

export function countLiveNonBankCharges(
  charges: Array<{ status?: string | null; personsEntitled?: string[] }>
): number {
  let count = 0;
  for (const charge of charges) {
    if (!isLiveCharge(charge.status)) continue;
    const names = charge.personsEntitled || [];
    if (names.length === 0) continue;
    if (names.some((person) => !isBankOrBuildingSocietyChargee(person))) count += 1;
  }
  return count;
}

export function isP0(input: { hasPetition?: boolean; liveNonBankChargeCount: number }): boolean {
  if (input.hasPetition) return true;
  return (input.liveNonBankChargeCount || 0) >= 1;
}
