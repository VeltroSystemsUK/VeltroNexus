const RATE = 19;
const TERM = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type HealthcheckMailInput = {
  email: string;
  company: string;
  balance: number;
  monthly: number;
  lenders: string[];
  brokerNote: string;
};

function cleanLine(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function parseHealthcheckMail(body: unknown): { ok: true; value: HealthcheckMailInput } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = cleanLine(raw.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Enter the email this should go to." };
  const balance = money(raw.balance);
  const monthly = money(raw.monthly);
  if (!(balance > 0) || balance > 100_000_000) return { ok: false, error: "Enter what is still owed." };
  if (!(monthly >= 0) || monthly > 10_000_000) return { ok: false, error: "Enter what you pay each month." };
  const lenders = Array.isArray(raw.lenders)
    ? raw.lenders.map((name) => cleanLine(name, 80)).filter(Boolean).slice(0, 40)
    : [];
  return {
    ok: true,
    value: {
      email,
      company: cleanLine(raw.company, 120),
      balance,
      monthly,
      lenders,
      brokerNote: cleanLine(raw.brokerNote, 800),
    },
  };
}

function gbp(n: number): string {
  return Math.round(n).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function illustratedMonthly(principal: number): number {
  const r = RATE / 100 / 12;
  const pow = Math.pow(1 + r, TERM);
  return principal * r * pow / (pow - 1);
}

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}

export function buildHealthcheckMail(input: HealthcheckMailInput): { subject: string; html: string; text: string } {
  const next = illustratedMonthly(input.balance);
  const delta = input.monthly - next;
  const hasCurrent = input.monthly > 0;
  const lower = hasCurrent && delta > 0;
  const who = input.company ? input.company + "'s" : "your";
  let numbers: string;
  if (!hasCurrent) {
    numbers = `Outstanding ${gbp(input.balance)}. Illustrated monthly ${gbp(next)} over 60 months.`;
  } else if (lower) {
    numbers = `Current monthly ${gbp(input.monthly)}. Outstanding ${gbp(input.balance)}. Illustrated monthly ${gbp(next)}, which is ${gbp(delta)} lower, over 60 months.`;
  } else {
    numbers = `Current monthly ${gbp(input.monthly)}. Outstanding ${gbp(input.balance)}. Illustrated monthly ${gbp(next)}, which is ${gbp(Math.abs(delta))} higher, over 60 months. On these figures the illustration is not lower.`;
  }
  const paragraphs = [
    "Hello,",
    `You asked for an illustration of ${who} monthly stack as one facility.`,
    numbers,
    "This is not a lending decision. Strata prepares your file. A CDFI or Specialist Funder will lend.",
  ];
  if (input.lenders.length) paragraphs.push(`Facilities confirmed: ${listPhrase(input.lenders)}.`);
  if (input.brokerNote) paragraphs.push(input.brokerNote);
  paragraphs.push("If a facility is missing, reply with the name.");
  const subject = "Your illustration" + (input.company ? " — " + input.company : "");
  const text = paragraphs.join("\n\n");
  const html = paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return { subject, html, text };
}

// Everything else the Business Check asked (clear-path.js `answers`). Optional and loosely
// parsed: a missing or odd field must never stop the visitor getting their email.
export type HealthcheckAnswers = {
  cards: Array<{ id: string; title: string; yes: boolean }>;
  heat: string;
  intent: string;
  broker: { arranged: string; name: string; fee: string; told: string };
  visitorToken: string;
  page: string;
};

const HEAT_LABEL: Record<string, string> = {
  juggling: "Level 1 — Juggling",
  demands: "Level 2 — Demands (letters, CCJs, bailiffs)",
  crisis: "Level 3 — Crisis (winding-up / closure threat)",
};
const INTENT_LABEL: Record<string, string> = {
  rescue: "Rescue & rebuild",
  break: "A clean break (close the company)",
  unsure: "Unsure",
};

export function parseHealthcheckAnswers(body: unknown): HealthcheckAnswers {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const a = raw.answers && typeof raw.answers === "object" ? (raw.answers as Record<string, unknown>) : {};
  const b = a.broker && typeof a.broker === "object" ? (a.broker as Record<string, unknown>) : {};
  const cards = Array.isArray(a.cards)
    ? a.cards.slice(0, 10).map((card: any) => ({
        id: cleanLine(card?.id, 40),
        title: cleanLine(card?.title, 120),
        yes: card?.yes === true,
      })).filter((card) => card.id)
    : [];
  return {
    cards,
    heat: cleanLine(a.heat, 40),
    intent: cleanLine(a.intent, 40),
    broker: {
      arranged: cleanLine(b.arranged, 20),
      name: cleanLine(b.name, 120),
      fee: cleanLine(b.fee, 20),
      told: cleanLine(b.told, 20),
    },
    visitorToken: cleanLine(a.visitorToken, 20),
    page: cleanLine(a.page, 300),
  };
}

// Internal notification to the director: every answer, one row each.
export function buildHealthcheckLeadNotice(input: HealthcheckMailInput, answers: HealthcheckAnswers, leadId?: number): { subject: string; html: string } {
  const next = illustratedMonthly(input.balance);
  const rows: Array<[string, string]> = [
    ["Email", input.email],
    ["Company", input.company || "not given"],
    ...answers.cards.map((card): [string, string] => [card.title || card.id, card.yes ? "Yes" : "Not an issue"]),
    ["Lenders", listPhrase(input.lenders) || "none ticked"],
    ["Broker arranged", answers.broker.arranged || "—"],
    ["Broker firm", answers.broker.name || "—"],
    ["Paid broker a fee", answers.broker.fee || "—"],
    ["Told commission in £", answers.broker.told || "—"],
    ["Still owed", gbp(input.balance)],
    ["Paying monthly", gbp(input.monthly)],
    ["Illustrated monthly", `${gbp(next)} (${TERM} months at ${RATE}%)`],
    ["Heat", HEAT_LABEL[answers.heat] || answers.heat || "—"],
    ["Wants", INTENT_LABEL[answers.intent] || answers.intent || "—"],
    ["Arrived via", answers.visitorToken ? `?d=${answers.visitorToken}` : "direct"],
  ];
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join("");
  return {
    subject: `Business Check lead — ${input.company || input.email}`,
    html: `<h2>New Business Check lead${leadId ? ` #${leadId}` : ""}</h2>`
      + "<p>Illustration emailed to the visitor. The page promised no further emails or calls, so this is in the CRM inbox only, not the pipeline or any sequence.</p>"
      + `<table>${table}</table>`,
  };
}
