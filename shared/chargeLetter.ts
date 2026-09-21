import { CLIENT_TRADING_NAME, DIRECTOR_NAME } from "./identity";
import { chargeHarvestSignal } from "./crmHarvestRank";
import { helloPublicOrigin } from "./helloHost";

export type ChargeLetterLead = {
  companyName: string;
  contactName?: string | null;
  address?: string | null;
  city?: string | null;
  identifiedLender?: string | null;
  hasCharges?: boolean | null;
};

export type ChargeLetter = {
  greeting: string;
  dateLine: string;
  addressLines: string[];
  body: string[];
  signOff: string;
  signRole: string;
};

function uninvertOfficer(name: string): string {
  const raw = String(name || "").trim();
  if (!raw.includes(",")) return raw;
  const [last, ...rest] = raw.split(",");
  const given = rest.join(" ").trim();
  return given ? `${given} ${last.trim()}` : raw;
}

export function letterFirstName(contactName?: string | null): string {
  const full = uninvertOfficer(String(contactName || ""));
  const token = full.split(/\s+/).find((part) => /^[A-Za-z]{2,}/.test(part));
  if (!token) return "";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function shortLenderName(raw?: string | null): string {
  const name = String(raw || "")
    .split(/[,;/|]|\band\b/i)[0]
    .trim()
    .replace(/\b(limited|ltd|llp|plc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || "a short-term lender";
}

export function letterForLead(lead: ChargeLetterLead, now: Date = new Date()): ChargeLetter | null {
  if (chargeHarvestSignal(lead) === "property_only") return null;
  if (!String(lead.identifiedLender || "").trim() && !lead.hasCharges) return null;
  const first = letterFirstName(lead.contactName);
  const lender = shortLenderName(lead.identifiedLender);
  const company = String(lead.companyName || "").trim();
  if (!company) return null;
  const dateLine = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const addressLines = [
    first ? `${uninvertOfficer(String(lead.contactName || ""))}` : "The Directors",
    company,
    String(lead.address || "").trim(),
    String(lead.city || "").trim(),
  ].filter(Boolean);
  return {
    dateLine,
    addressLines,
    greeting: first ? `Dear ${first},` : "Dear Directors,",
    body: [
      `I was looking at ${company} and saw a live charge with ${lender}. I am not writing to sell you a loan. I package commercial facilities — usually a longer, cheaper term than that kind of short money, if the figures support it.`,
      `If the ${lender} line is doing a job, please ignore this. If it is expensive and you would rather it was not, I am easy to reach. There is a short note here rather than a pack in the envelope: ${helloPublicOrigin()}.`,
      `One letter. No follow-up pile unless you reply.`,
    ],
    signOff: DIRECTOR_NAME,
    signRole: CLIENT_TRADING_NAME,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function chargeLetterHtml(leads: ChargeLetterLead[], now: Date = new Date()): string {
  const letters = leads.map((lead) => letterForLead(lead, now)).filter(Boolean) as ChargeLetter[];
  const pages = letters
    .map((letter) => {
      const address = letter.addressLines.map((line) => escapeHtml(line)).join("<br>");
      const paras = letter.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
      return `<article class="letter">
  <p class="date">${escapeHtml(letter.dateLine)}</p>
  <p class="addr">${address}</p>
  <p class="greet">${escapeHtml(letter.greeting)}</p>
  ${paras}
  <p class="yours">Yours sincerely,</p>
  <p class="sign">${escapeHtml(letter.signOff)}</p>
  <p class="role">${escapeHtml(letter.signRole)}</p>
</article>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>Charge letters</title>
  <style>
    @page { size: A4; margin: 22mm 22mm 24mm 22mm; }
    html, body { margin: 0; background: #f4f1ea; }
    body { font-family: Georgia, "Times New Roman", Times, serif; color: #1a1814; }
    .toolbar { font-family: system-ui, sans-serif; font-size: 13px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #ddd; }
    .letter {
      background: #fffef8;
      max-width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      padding: 22mm 22mm 24mm 22mm;
      box-sizing: border-box;
      page-break-after: always;
    }
    .date { text-align: right; margin: 0 0 28px; }
    .addr { margin: 0 0 28px; line-height: 1.45; }
    .greet { margin: 0 0 18px; }
    .letter p { font-size: 12.5pt; line-height: 1.55; margin: 0 0 14px; max-width: 36em; }
    .yours { margin-top: 28px; }
    .sign { font-style: italic; font-size: 16pt; margin: 4px 0 0; }
    .role { font-size: 11pt; color: #444; margin: 0; }
    @media print {
      html, body { background: #fff; }
      .toolbar { display: none; }
      .letter { margin: 0; min-height: auto; box-shadow: none; page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="toolbar">Print to PDF — one A4 per letter, black, second class / hybrid mail. Together-only property charges are omitted.</div>
  ${pages || "<p style='padding:2rem'>No letters. Need a business-loan charge and a company name.</p>"}
</body>
</html>`;
}
