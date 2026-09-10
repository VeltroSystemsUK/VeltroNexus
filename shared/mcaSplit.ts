export type McaChannel = "own-remittance" | "website-ebay" | "paypal";

export type McaMin = {
  amount: number;
  months: number;
};

export type McaProduct = {
  brand: string;
  match: RegExp;
  defaultRate: number | null;
  defaultMin?: McaMin | null;
  channel: McaChannel;
};

export const MCA_PRODUCTS: McaProduct[] = [
  { brand: "YouLend", match: /youlend/i, defaultRate: 0.22, channel: "own-remittance" },
  { brand: "Shopify Capital", match: /shopify capital/i, defaultRate: 0.17, channel: "website-ebay" },
  {
    brand: "PayPal Working Capital",
    match: /paypal funding|paypal working capital/i,
    defaultRate: 0.3,
    defaultMin: { amount: 2978, months: 3 },
    channel: "paypal",
  },
  { brand: "Liberis", match: /liberis/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Capify", match: /capify/i, defaultRate: null, channel: "own-remittance" },
  { brand: "365 Finance", match: /365 finance|365 business/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Fleximize", match: /fleximize/i, defaultRate: null, channel: "own-remittance" },
  { brand: "1plus1", match: /1plus1|1 plus 1/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Boost Capital", match: /boost capital/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Wayflyer", match: /wayflyer/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Uncapped", match: /uncapped/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Revenu", match: /\brevenu\b/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Stripe Capital", match: /stripe capital/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Square Capital", match: /square capital/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Amazon Lending", match: /amazon (?:lending|capital)/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Rapid Finance", match: /rapid finance/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Merchant Money", match: /merchant money/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Bizcap", match: /bizcap/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Headway Capital", match: /headway capital/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Kriya", match: /\bkriya\b/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Everline", match: /everline/i, defaultRate: null, channel: "own-remittance" },
  { brand: "Capalona", match: /capalona/i, defaultRate: null, channel: "own-remittance" },
];

const INSTALMENT = /iwoca|funding circle/i;

export function isInstalmentFinance(name: string): boolean {
  return INSTALMENT.test(name);
}

export function mcaProductFor(name: string): McaProduct | undefined {
  return MCA_PRODUCTS.find((product) => product.match.test(name));
}

function asRate(raw: string | undefined): number | undefined {
  const rate = raw ? Number(raw) / 100 : NaN;
  return rate >= 0.05 && rate <= 0.55 ? rate : undefined;
}

function closestSplitRate(blob: string, source: string): number | undefined {
  let best: { dist: number; rate: number } | undefined;
  const nameRe = new RegExp(source, "gi");
  let found: RegExpExecArray | null;
  while ((found = nameRe.exec(blob))) {
    const window = blob.slice(found.index + found[0].length, found.index + found[0].length + 200);
    const ofMatch = window.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*of/i);
    const nearMatch = window.slice(0, 60).match(/(\d{1,2}(?:\.\d+)?)\s*%/);
    const rate = asRate(ofMatch?.[1] ?? nearMatch?.[1]);
    if (rate == null) continue;
    const dist = ofMatch ? window.indexOf(ofMatch[0]) : 999;
    if (!best || dist < best.dist) best = { dist, rate };
  }
  return best?.rate;
}

function namePattern(name: string): string | null {
  const tokens = String(name || "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !/^(ltd|limited|uk|inc|llp|plc|the|mca)$/i.test(token));
  if (!tokens.length) return null;
  return tokens
    .slice(0, 2)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
}

export function parseMcaRatesFromText(text: string, extraNames: string[] = []): Record<string, number> {
  const blob = String(text || "");
  const rates: Record<string, number> = {};
  for (const product of MCA_PRODUCTS) {
    const rate = closestSplitRate(blob, product.match.source);
    if (rate != null) rates[product.brand] = rate;
  }
  for (const name of extraNames) {
    if (isInstalmentFinance(name) || mcaProductFor(name)) continue;
    const pattern = namePattern(name);
    if (!pattern) continue;
    const rate = closestSplitRate(blob, pattern);
    if (rate == null) continue;
    rates[name.replace(/\s+/g, " ").trim()] = rate;
  }
  return rates;
}

export function resolveMcaRate(name: string, parsed: Record<string, number>): number | null {
  if (isInstalmentFinance(name)) return null;
  const product = mcaProductFor(name);
  if (product) {
    if (parsed[product.brand] != null) return parsed[product.brand]!;
    return product.defaultRate;
  }
  for (const [brand, rate] of Object.entries(parsed)) {
    if (brand.length < 4) continue;
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(escaped, "i").test(name)) return rate;
    const pattern = namePattern(name);
    if (pattern && new RegExp(pattern, "i").test(brand)) return rate;
  }
  return null;
}

export function splitHoldback(netIn: number, rate: number): number {
  if (!(netIn > 0) || !(rate > 0) || !(rate < 1)) return 0;
  return Math.round(((netIn * rate) / (1 - rate)) * 100) / 100;
}

export function salesSplitTake(sales: number, rate: number): number {
  if (!(sales > 0) || !(rate > 0) || !(rate < 1)) return 0;
  return Math.round(sales * rate * 100) / 100;
}

export function minMonthly(min: McaMin | null | undefined): number {
  if (!min || !(min.amount > 0) || !(min.months > 0)) return 0;
  return Math.round((min.amount / min.months) * 100) / 100;
}

export function parseMcaMinsFromText(text: string): Record<string, McaMin> {
  const blob = String(text || "");
  const mins: Record<string, McaMin> = {};
  for (const product of MCA_PRODUCTS) {
    const nameRe = new RegExp(product.match.source, "gi");
    let found: RegExpExecArray | null;
    let best: { dist: number; min: McaMin } | undefined;
    while ((found = nameRe.exec(blob))) {
      const window = blob.slice(found.index, found.index + found[0].length + 280);
      const match = window.match(
        /min(?:imum)?\s*£?\s*([\d,]+(?:\.\d+)?)\s*(?:every|per|\/)\s*(\d+)\s*months?/i,
      );
      if (!match) continue;
      const amount = Number(String(match[1]).replace(/,/g, ""));
      const months = Number(match[2]);
      if (!(amount >= 50) || !(months >= 1) || months > 24) continue;
      const dist = window.indexOf(match[0]);
      if (!best || dist < best.dist) best = { dist, min: { amount, months } };
    }
    if (best) mins[product.brand] = best.min;
  }
  return mins;
}

export function resolveMcaMin(
  name: string,
  parsed: Record<string, McaMin>,
  onSchedule: boolean,
): McaMin | null {
  const product = mcaProductFor(name);
  if (!product) return null;
  if (parsed[product.brand]) return parsed[product.brand]!;
  if (onSchedule && product.defaultMin) return product.defaultMin;
  return null;
}
