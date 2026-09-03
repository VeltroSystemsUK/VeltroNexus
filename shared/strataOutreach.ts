import type { AgenticDealFile } from "./agenticWorkflow";
import { mailboxForAgent, type AgentMailbox } from "./agentMailboxes";
import { namedPackGaps, requiredCustomerPackLabels } from "./sterlingCompleteness";
import {
  cadenceFor,
  dealStream,
  formatFacilityBand,
  nextCadenceStep,
  type CadenceTouchId,
  type SalesStream,
} from "./salesOs";

export type OutreachTouchId = CadenceTouchId | "cold_1" | "cold_2" | "cold_3" | "sme_open";

export interface RenderedEmail {
  touchId: OutreachTouchId;
  subject: string;
  html: string;
  text: string;
  purpose: string;
}

export type OutreachTemplateOverride = {
  subject?: string;
  body?: string;
  purpose?: string;
};

export const EDITABLE_OUTREACH_TOUCHES: OutreachTouchId[] = [
  "inbound_ack",
  "inbound_chase",
  "sme_1",
  "sme_open",
  "sme_2",
  "sme_close",
  "intro_1",
  "intro_2",
];

export interface CallBeat {
  label: string;
  say: string;
}

export interface CallPlaybook {
  title: string;
  when: string;
  opener: string;
  beats: CallBeat[];
  objections: { hear: string; say: string }[];
  voicemail: string;
  close: string;
}

const SITE = "stratafinance.co.uk";

export function firstName(contactName?: string | null): string {
  const token = String(contactName || "").trim().split(/\s+/)[0] || "";
  if (!token || /^(hi|there|sir|madam|team|director)$/i.test(token)) return "there";
  return token;
}

export function lenderLabel(deal: Pick<AgenticDealFile, "fitReasons" | "fitSummary">): string {
  const blob = [deal.fitSummary, ...(deal.fitReasons || [])].join(" | ");
  const paren = blob.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].split(",")[0].trim();
  if (/merchant cash|mca|daily-repay/i.test(blob)) return "a daily-repay / merchant cash facility";
  if (/high-cost alternative/i.test(blob)) return "a high-cost short-term facility";
  return "a high-cost short-term facility";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2E5096;word-break:break-all;">$1</a>'
  );
}

function htmlEmail(lines: string[]): string {
  return lines.map((line) => `<p>${linkify(escapeHtml(line))}</p>`).join("\n");
}

export function packUploadUrl(token?: string | null): string | undefined {
  if (!token) return undefined;
  const base = (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://leads.stratanexus.co.uk"
  ).replace(/\/$/, "");
  return `${base}/pack/${encodeURIComponent(token)}`;
}

function uploadButtonHtml(url: string): string {
  return `
<p style="margin:24px 0 10px 0;">
  <a href="${escapeHtml(url)}" style="display:inline-block;background:#2E5096;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:14px;">Upload your documents</a>
</p>
<p style="margin:0 0 16px 0;font-size:13px;line-height:1.45;color:#374151;font-family:Arial,Helvetica,sans-serif;">If the button does not work, use this link:<br/><a href="${escapeHtml(url)}" style="color:#2E5096;word-break:break-all;">${escapeHtml(url)}</a></p>`.trim();
}

const SME_QUIZ_URL = "https://explore.stratanexus.co.uk";
const SME_LEARN_URL = "https://learn.stratanexus.co.uk";

function learnButtonHtml(url: string): string {
  return `
<p style="margin:24px 0 10px 0;">
  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2E5096;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:14px;">Start the training</a>
</p>
<p style="margin:0 0 16px 0;font-size:13px;line-height:1.45;color:#374151;font-family:Arial,Helvetica,sans-serif;">If the button does not work, use this link:<br/><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#2E5096;word-break:break-all;">${escapeHtml(url)}</a></p>`.trim();
}

const LOGO_URL =
  process.env.STRATA_LOGO_URL || "https://leads.stratanexus.co.uk/images/strata-logo-light.png";

// The four brand colours from the site header's divider bar (stratafinance.co.uk).
const BRAND_COLORS = ["#2E5096", "#C68B22", "#439840", "#C41E28"];

function colorDividerHtml(): string {
  const cells = BRAND_COLORS.map(
    (color) => `<td width="25%" style="background:${color};height:4px;line-height:4px;font-size:0;">&nbsp;</td>`
  ).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;line-height:0;font-size:0;"><tr>${cells}</tr></table>`;
}
const PHONE = process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER || "0115 984 9800";
const ADDRESS =
  process.env.STRATA_ADDRESS ||
  "Sterling House, Unit 5 Wheatcroft Business Park, Landmere Lane, Edwalton, Nottingham NG12 4DG";

export function signatureText(mailbox: AgentMailbox): string {
  return [
    "Kind regards,",
    "",
    mailbox.displayName,
    mailbox.role,
    "Strata Finance",
    mailbox.address,
    PHONE,
    ADDRESS,
    `https://${SITE}`,
    "",
    "Strata Finance arranges non-regulated commercial B2B finance and is not authorised by the FCA. We are not a lender.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export function signatureHtml(mailbox: AgentMailbox): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:0;">
      ${colorDividerHtml()}
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
        <tr>
          <td valign="middle" style="padding-right:16px;">
            <a href="https://${SITE}"><img src="${escapeHtml(LOGO_URL)}" alt="Strata Finance" width="160" height="42" style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:160px;" /></a>
          </td>
          <td valign="middle" style="border-left:1px solid #D1D5DB;padding-left:16px;font-size:13px;line-height:1.45;color:#111827;">
            <p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:#111827;">${escapeHtml(mailbox.displayName)}</p>
            <p style="margin:0 0 8px 0;color:#2E5096;">${escapeHtml(mailbox.role)} · Strata Finance</p>
            <p style="margin:0;"><a href="mailto:${escapeHtml(mailbox.address)}" style="color:#2E5096;text-decoration:none;">${escapeHtml(mailbox.address)}</a></p>
            ${PHONE ? `<p style="margin:0;color:#374151;">${escapeHtml(PHONE)}</p>` : ""}
            ${ADDRESS ? `<p style="margin:0;color:#374151;">${escapeHtml(ADDRESS)}</p>` : ""}
            <p style="margin:4px 0 0 0;"><a href="https://${SITE}" style="color:#2E5096;text-decoration:none;">${SITE}</a></p>
          </td>
        </tr>
      </table>
      <div style="margin-top:14px;">${colorDividerHtml()}</div>
      <p style="margin:12px 0 0 0;font-size:11px;line-height:1.4;color:#6B7280;max-width:520px;">
        Strata Finance is not authorised or regulated by the FCA. We arrange non-regulated commercial business-to-business finance and are not a lender.
      </p>
    </td>
  </tr>
</table>`.trim();
}

function withSignature(
  lines: string[],
  mailbox: AgentMailbox,
  extra?: string[],
  beforeSignatureHtml?: string
): { html: string; text: string } {
  const bodyHtml = htmlEmail(lines);
  const extraHtml = extra?.length ? htmlEmail(extra) : "";
  return {
    html: `${bodyHtml}\n${beforeSignatureHtml || ""}\n${signatureHtml(mailbox)}${extraHtml ? `\n${extraHtml}` : ""}`,
    text: [...lines, "", signatureText(mailbox), ...(extra || [])].join("\n\n"),
  };
}

function canonicalTouchId(touchId: OutreachTouchId): CadenceTouchId | "sme_open" {
  if (touchId === "cold_1") return "sme_1";
  if (touchId === "cold_2") return "sme_2";
  if (touchId === "cold_3") return "sme_close";
  return touchId;
}

const STOP_LINE = "If this isn't useful, reply stop and we won't email again.";

function formatHearing(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function dealHasHmrcPetition(
  deal: Pick<AgenticDealFile, "petition" | "fitReasons" | "fitSummary">
): boolean {
  if (deal.petition?.kind === "hmrc_winding_up") return true;
  const blob = [deal.fitSummary, ...(deal.fitReasons || [])].join(" ");
  return /hmrc/i.test(blob) && /petition/i.test(blob);
}

export function renderOutreachEmail(
  deal: Pick<
    AgenticDealFile,
    | "companyName"
    | "contactName"
    | "fitReasons"
    | "fitSummary"
    | "uploadToken"
    | "loanAmount"
    | "stream"
    | "source"
    | "petition"
  >,
  touchId: OutreachTouchId,
  senderNameOrMailbox?: string | AgentMailbox
): RenderedEmail {
  const mailbox =
    typeof senderNameOrMailbox === "object" && senderNameOrMailbox
      ? senderNameOrMailbox
      : mailboxForAgent(senderNameOrMailbox);
  const name = firstName(deal.contactName);
  const company = deal.companyName;
  const facility = formatFacilityBand(deal.loanAmount);
  const id = canonicalTouchId(touchId);

  if (id === "inbound_ack") {
    const uploadUrl = packUploadUrl(deal.uploadToken);
    const packList = requiredCustomerPackLabels().join("; ");
    const lines = [
      `Hi ${name},`,
      `Thanks for getting in touch via Strata Finance. We've opened a file for ${company}.`,
      `To take this forward, please upload: ${packList}.`,
      uploadUrl
        ? `The easiest way is to upload them on this secure page: ${uploadUrl}`
        : `Reply here with those, or say when a quick call would help.`,
      uploadUrl ? `You can also reply here with the files, or tell me when a quick call would help.` : "",
    ].filter(Boolean);
    const signed = withSignature(lines, mailbox, undefined, uploadUrl ? uploadButtonHtml(uploadUrl) : undefined);
    return {
      touchId: id,
      subject: `Thanks for your enquiry — ${company}`,
      html: signed.html,
      text: signed.text,
      purpose: "Acknowledge a live Strata enquiry and ask for the pack.",
    };
  }

  if (id === "inbound_chase") {
    const uploadUrl = packUploadUrl(deal.uploadToken);
    const gaps = namedPackGaps({
      documents: (deal as AgenticDealFile).packDocuments,
      fundingReason: (deal as AgenticDealFile).fundingReason,
      companyNumber: (deal as AgenticDealFile).companyNumber,
    });
    const stillNeed = gaps.length ? gaps.join("; ") : requiredCustomerPackLabels().join("; ");
    const lines = [
      `Hi ${name},`,
      `Just checking in on the pack for ${company}. I still need: ${stillNeed}.`,
      `Once those land we can tell you quickly whether a refinance / Time to Pay route is realistic. No obligation.`,
      uploadUrl ? `Upload them here: ${uploadUrl}` : `Reply with the files, or tell me a time to call.`,
      uploadUrl ? `Or reply with the files, or tell me a time to call.` : "",
    ].filter(Boolean);
    const signed = withSignature(lines, mailbox, undefined, uploadUrl ? uploadButtonHtml(uploadUrl) : undefined);
    return {
      touchId: id,
      subject: `${company} — still happy to look at this`,
      html: signed.html,
      text: signed.text,
      purpose: "Chase the pack on a live inbound before the warm call.",
    };
  }

  if (id === "sme_1") {
    if (dealHasHmrcPetition(deal)) {
      const hearing = formatHearing(deal.petition?.hearingAt);
      const lines = [
        `Hi ${name},`,
        `A winding-up petition presented by HMRC against ${company} is now on the public record.${hearing ? ` The hearing is listed for ${hearing}.` : ""}`,
        `That is still a cash-flow problem, not an insolvency file. Through Strata Finance we place a single CDFI facility (${facility}, terms up to 5 years) that can settle or restructure the HMRC balance before the petition is heard, and we build the 24-month pack the credit committee requires.`,
        `You can review the structure here: https://${SITE}/strata-solution.html`,
        `Would you be open to a 10-minute confidential look at the petition and the current debt schedule this week?`,
      ];
      const signed = withSignature(lines, mailbox, [STOP_LINE]);
      return {
        touchId: id,
        subject: `HMRC petition against ${company} — a CDFI route before the hearing`,
        html: signed.html,
        text: signed.text,
        purpose: "Stream A day 1 — Gazette HMRC petition buying signal. Ask for a 10-minute review.",
      };
    }
    const lines = [
      `Hi ${name},`,
      `Servicing multiple short-term finance facilities, daily merchant cash advances, or HMRC arrangements often creates an artificial cash-flow ceiling—even for profitable, well-run businesses.`,
      `Through Strata Finance, we restructure fragmented commercial debt portfolios into single, structured CDFI facilities (${facility} over terms up to 5 years):`,
      `• Immediate Cash-Flow Relief: Halve aggregate monthly debt servicing outgoings.`,
      `• HMRC Clearance: Settle or restructure Time to Pay arrangements into sustainable, long-term facilities.`,
      `• Institutional Modeling: We build the 24-month integrated P&L, Balance Sheet, and cash-flow models underwriters require.`,
      `You can review our consolidation structure here: https://${SITE}/strata-solution.html`,
      `Would you be open to a 10-minute confidential review of your existing debt schedule this week?`,
    ];
    const signed = withSignature(lines, mailbox, [STOP_LINE]);
    return {
      touchId: id,
      subject: `Restructuring ${company}’s monthly debt commitments`,
      html: signed.html,
      text: signed.text,
      purpose: "Stream A day 1 — debt service reduction. Ask for a 10-minute review.",
    };
  }

  if (touchId === "sme_open") {
    const lines = [
      `Hi ${name},`,
      `Thanks for taking an interest in how we can help ${company} with high-cost debt and HMRC commitments.`,
      `If it's useful, there is a short training path here that explains stacked debt, cashflow, HMRC Time to Pay, and how a packager works:`,
      SME_LEARN_URL,
      `When you are ready, the four-question assessment is still here: ${SME_QUIZ_URL}`,
      `It takes about a minute.`,
    ];
    const signed = withSignature(lines, mailbox, [STOP_LINE], learnButtonHtml(SME_LEARN_URL));
    return {
      touchId: "sme_open",
      subject: `A 60-second look at ${company}`,
      html: signed.html,
      text: signed.text,
      purpose: "First open of sme_1 — thank them, point at Learn, and name the Explore assessment.",
    };
  }

  if (id === "sme_linkedin") {
    const text = dealHasHmrcPetition(deal)
      ? `Hi ${name} — I work with UK directors facing an HMRC winding-up petition on ${company}. We restructure that tax and any stacked short-term borrowing into a single CDFI facility so the petition can be settled. Thought it made sense to connect.`
      : `Hi ${name} — noticed your work leading ${company}. We work directly with UK business directors to restructure high-cost borrowing and HMRC commitments into manageable, longer-term CDFI facilities. Thought it made sense to connect.`;
    return {
      touchId: id,
      subject: `LinkedIn connection — ${company}`,
      html: htmlEmail(text.split("\n")),
      text,
      purpose: "Stream A day 4 — LinkedIn connection request. Not an email.",
    };
  }

  if (id === "sme_2") {
    const lines = [
      `Hi ${name},`,
      `When commercial borrowing is split across multiple short-term providers, the compounded repayments can strain day-to-day operations.`,
      `A recent engineering firm we supported was carrying 3 active cash advances alongside a £40k PAYE arrears demand—amounting to over £14,000 in monthly repayments. We restructured the entire balance into a single £150,000 5-year CDFI facility, reducing their monthly commitment to £3,200 and clearing HMRC in full.`,
      `If ${company} is navigating high monthly debt commitments, you can see how CDFI funding operates here: https://${SITE}/cdfi-funding.html`,
      `Do you have 5 minutes for a brief call on Thursday?`,
    ];
    const signed = withSignature(lines, mailbox, [STOP_LINE]);
    return {
      touchId: id,
      subject: "Case Study: Reducing £14,000/mo debt servicing to £3,200/mo",
      html: signed.html,
      text: signed.text,
      purpose: "Stream A day 8 — case study. Ask for a Thursday call.",
    };
  }

  if (id === "sme_close") {
    const lines = [
      `Hi ${name},`,
      `I am closing out my review file for ${company} this week.`,
      `If current debt servicing or HMRC commitments are limiting your working capital, we remain available to run a complimentary 24-month cash-flow restructuring model for your board.`,
      `If the timing is not right, you can retain our direct details for the future: https://${SITE}/strata-solution.html`,
    ];
    const signed = withSignature(lines, mailbox, [STOP_LINE]);
    return {
      touchId: id,
      subject: `Next steps for ${company}`,
      html: signed.html,
      text: signed.text,
      purpose: "Stream A day 14 — close email. Queue the SME voice call.",
    };
  }

  if (id === "intro_1") {
    const lines = [
      `Hi ${name},`,
      `When viable corporate clients face cash-flow pressure caused by high-interest short-term debt, stacked Merchant Cash Advances, or HMRC arrears, standard high-street lenders rarely step forward.`,
      `Strata Finance works directly with accountancy practices and corporate advisers to restructure complex debt profiles into sustainable CDFI (Community Development Finance Institution) facilities:`,
      `1. Institutional Credit Packaging: We construct the full 24-month integrated P&L, balance sheet, and CFADS/DSCR models required by CDFI credit committees.`,
      `2. Tax Arrears Resolution: Stabilise and consolidate HMRC liabilities into affordable 5-year facilities (£25k to £250k).`,
      `3. Client Retention: We eliminate immediate cash-flow threats while keeping your advisory relationship central.`,
      `You can inspect our advisory framework here: https://${SITE}`,
      `Could we arrange a 10-minute introductory call on Thursday?`,
    ];
    const signed = withSignature(lines, mailbox, [STOP_LINE]);
    return {
      touchId: id,
      subject: "Refinancing & HMRC restructuring mechanism for your corporate clients",
      html: signed.html,
      text: signed.text,
      purpose: "Stream B day 1 — partner outreach.",
    };
  }

  if (id === "intro_linkedin") {
    const text = `Hi ${name}, following up on my email regarding our CDFI restructuring framework. We frequently partner with accountancy practices whose clients need to refinance aggressive short-term debt or formalise HMRC Time to Pay arrangements. We manage the entire 24-month financial model and underwriter pack. I would welcome the opportunity to share our structure: https://${SITE}`;
    return {
      touchId: id,
      subject: `LinkedIn briefing — ${company}`,
      html: htmlEmail(text.split("\n")),
      text,
      purpose: "Stream B day 5 — LinkedIn technical briefing. Not an email.",
    };
  }

  const lines = [
    `Hi ${name},`,
    `I wanted to check if your practice currently has clients navigating cash-flow restrictions due to aggressive monthly debt service or HMRC arrears.`,
    `We can review client debt schedules on a confidential, no-obligation basis and produce a preliminary restructuring feasibility model within 48 hours.`,
    `Let me know if you would like to schedule a brief introductory briefing: https://${SITE}`,
  ];
  const signed = withSignature(lines, mailbox, [STOP_LINE]);
  return {
    touchId: "intro_2",
    subject: "Supporting distressed debt files for your clients",
    html: signed.html,
    text: signed.text,
    purpose: "Stream B day 10 — partner alignment. Queue the introducer voice call.",
  };
}

function templateTokens(value: string, deal: Pick<AgenticDealFile, "companyName" | "contactName" | "loanAmount" | "uploadToken">): string {
  return value
    .replace(/\{\{firstName\}\}/gi, firstName(deal.contactName))
    .replace(/\{\{company\}\}/gi, deal.companyName || "the company")
    .replace(/\{\{facility\}\}/gi, formatFacilityBand(deal.loanAmount))
    .replace(/\{\{uploadUrl\}\}/gi, packUploadUrl(deal.uploadToken) || "the secure upload page");
}

export function applyOutreachTemplateOverride(
  rendered: RenderedEmail,
  override: OutreachTemplateOverride | undefined,
  deal: Pick<AgenticDealFile, "companyName" | "contactName" | "loanAmount" | "uploadToken">,
  mailbox: AgentMailbox,
): RenderedEmail {
  if (!override?.body?.trim() || /preview-token|\/pack\/preview-token/i.test(override.body)) return rendered;
  const body = templateTokens(override.body.trim(), deal);
  const lines = body.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  const signed = withSignature(
    lines,
    mailbox,
    rendered.touchId === "inbound_ack" || rendered.touchId === "inbound_chase" ? undefined : [STOP_LINE],
  );
  return {
    ...rendered,
    subject: templateTokens(String(override.subject || rendered.subject), deal),
    purpose: String(override.purpose || rendered.purpose),
    html: signed.html,
    text: signed.text,
  };
}

export function editableOutreachBody(rendered: RenderedEmail, mailbox: AgentMailbox): string {
  const signatureIndex = rendered.text.indexOf(signatureText(mailbox));
  return (signatureIndex >= 0 ? rendered.text.slice(0, signatureIndex) : rendered.text).trim();
}

export function nextColdTouch(outreachTouch: number | undefined, stream: SalesStream = "sme"): OutreachTouchId {
  const next = nextCadenceStep(stream, !outreachTouch || outreachTouch < 1 ? 0 : outreachTouch);
  return next?.touchId || (stream === "introducer" ? "intro_2" : "sme_close");
}

export function renderWarmCall(
  deal: Pick<AgenticDealFile, "companyName" | "contactName" | "phone" | "email">,
  callbackNumber?: string
): CallPlaybook {
  const name = firstName(deal.contactName);
  const company = deal.companyName;
  const callback = callbackNumber || "the number on your enquiry email";

  return {
    title: "Warm inbound call",
    when: "They already enquired at stratafinance.co.uk and the pack has not arrived. This is not a cold call.",
    opener: `Hi ${name}, it's Shaun from Strata Finance. You sent an enquiry about ${company} — have you got two minutes?`,
    beats: [
      {
        label: "1. Permission",
        say: "If now is bad, when today or tomorrow works? (Book it. Don't push.)",
      },
      {
        label: "2. Confirm why they came",
        say: "When you came through the site, was it stacked short-term loans, HMRC arrears, a bank decline, or cashflow timing?",
      },
      {
        label: "3. Diagnose (one at a time)",
        say: "How many facilities are being paid each month? Any HMRC Time to Pay or arrears? Did the bank or another broker already say no?",
      },
      {
        label: "4. The Strata route (30 seconds)",
        say: "If tax is in the way we sort a Time to Pay first. Then we rebuild the expensive stack into one longer-term facility the business can actually service — often via CDFIs. We don't add another short-term loan on top.",
      },
      {
        label: "5. The ask",
        say: "To take this forward I need the pack on the secure upload link in Maya's email — bank statements, accounts, cash-flow forecast, debt schedule, director ID, and a note on why the funding is needed. Can you send those today, or shall I text a reminder?",
      },
    ],
    objections: [
      {
        hear: "Too busy / send something",
        say: "I'll keep it to that three-item list. What time should I check you've had it?",
      },
      {
        hear: "Already speaking to someone",
        say: "Fine. If they're offering another short-term facility, that's the trap. I'm happy to give a second view on the public file only.",
      },
      {
        hear: "How did you get my number? / who are you?",
        say: "You enquired at stratafinance.co.uk. I'm Shaun. If you'd rather stay on email, I'll leave it there.",
      },
      {
        hear: "Not interested / stop calling",
        say: "Understood. I won't call again. If repayments get worse, the site is stratafinance.co.uk.",
      },
    ],
    voicemail: `Shaun from Strata Finance, following your enquiry for ${company}. I'll try you again, or call me on ${callback}. Shaun, Strata Finance, ${callback}.`,
    close: `If they agree: confirm the three documents and a review slot. If they refuse twice: stop. Log the outcome on the deal file.`,
  };
}

export function renderSmeCall(
  deal: Pick<AgenticDealFile, "companyName" | "contactName">,
  agentName = "James Hale",
  callbackNumber?: string
): CallPlaybook {
  const name = firstName(deal.contactName);
  const callback = callbackNumber || PHONE;

  return {
    title: "Direct SME call — high borrowing / charge register",
    when: "Stream A day 14, or after an opened email. Charge-register or stacked-MCA trigger.",
    opener: `Good morning/afternoon ${name}, it's ${agentName} calling from Strata Finance. I'm reaching out directly because we specialise in helping UK business directors restructure high-cost short-term borrowing and HMRC commitments into single, manageable 5-year CDFI loans. Have I caught you between meetings?`,
    beats: [
      {
        label: "If yes / go ahead",
        say: "The reason for my call is that many business owners are currently servicing stacked loans or cash advances where the daily and weekly debits are cutting into working capital. We model and consolidate that borrowing into structured facilities from £25k up to £250k, typically cutting monthly debt servicing in half.",
      },
      {
        label: "Discovery 1",
        say: "Are you currently managing multiple debt repayments or an active HMRC Time to Pay arrangement?",
      },
      {
        label: "Discovery 2",
        say: "Roughly what proportion of your monthly turnover is currently tied up in debt servicing?",
      },
      {
        label: "Discovery 3",
        say: "If those multiple facilities were combined into a single, lower monthly payment over 5 years, what would that free up in terms of operational headroom?",
      },
      {
        label: "CTA",
        say: "We can complete a confidential 10-minute debt schedule assessment. If you provide your current debt schedule or management accounts, our team will run an integrated cash-flow model showing the impact of a CDFI consolidation facility. What is the best direct email address to send our onboarding checklist to?",
      },
    ],
    objections: [
      {
        hear: "Too busy",
        say: "Understood. What time today or tomorrow works for a 10-minute look at the debt schedule?",
      },
      {
        hear: "Already speaking to a broker",
        say: "That's fine. We work directly with CDFIs rather than stacking another short-term facility. Happy to give a second view on the public file only.",
      },
      {
        hear: "Not interested / stop calling",
        say: "Understood. I won't call again. If monthly servicing gets heavier, we are at stratafinance.co.uk.",
      },
    ],
    voicemail: `${agentName} from Strata Finance, calling about restructuring high-cost borrowing for ${deal.companyName}. I'll try you again, or call me on ${callback}.`,
    close: "If they agree: capture email, send the onboarding checklist, open the pack file. If they refuse twice: stop.",
  };
}

export function renderIntroducerCall(
  deal: Pick<AgenticDealFile, "companyName" | "contactName">,
  agentName = "James Hale",
  callbackNumber?: string
): CallPlaybook {
  const name = firstName(deal.contactName);
  const callback = callbackNumber || PHONE;

  return {
    title: "Introducer call — practice partner / fractional CFO",
    when: "Stream B day 10, or after an opened partner email.",
    opener: `Good morning/afternoon ${name}, it's ${agentName} with Strata Finance. We partner directly with chartered accountancy practices whose clients are navigating complex short-term debt, stacked lenders, or HMRC arrears that mainstream commercial banks will not touch. Do you have two minutes?`,
    beats: [
      {
        label: "If yes / go ahead",
        say: "When viable corporate clients fall behind on PAYE/VAT or are suffocated by short-term cash advances, insolvency is often unnecessary. We build the full 24-month integrated balance sheet and CFADS cash-flow models required to place £25k–£250k debt consolidation packs directly with regional and national CDFIs.",
      },
      {
        label: "Discovery 1",
        say: "Do you have clients currently facing aggressive HMRC enforcement or unsustainable Time to Pay terms?",
      },
      {
        label: "Discovery 2",
        say: "How does your practice currently handle clients carrying expensive non-bank debt that needs long-term refinancing?",
      },
      {
        label: "CTA",
        say: "We would like to set up a 10-minute briefing with our senior packaging team to show you the Passan-style financial packs we generate for CDFI lenders. Would Thursday morning suit for a brief introductory call?",
      },
    ],
    objections: [
      {
        hear: "We already have a panel",
        say: "Good. We sit alongside, not instead of, your existing relationships — specifically for stacked MCA / HMRC files the high-street panel will not take.",
      },
      {
        hear: "Send something",
        say: "I'll send the advisory framework and a sample 24-month pack outline. What is the best email, and when should I check you've had it?",
      },
      {
        hear: "Not interested / stop calling",
        say: "Understood. I won't call again. The site is stratafinance.co.uk if a client file comes up later.",
      },
    ],
    voicemail: `${agentName} from Strata Finance, calling ${deal.companyName} about a CDFI restructuring partnership for corporate clients. Call me on ${callback}.`,
    close: "If they agree: book the Thursday briefing. If they refuse twice: stop.",
  };
}

export function renderCallForDeal(
  deal: Pick<AgenticDealFile, "companyName" | "contactName" | "phone" | "email" | "source" | "stream">,
  callbackNumber?: string
): CallPlaybook {
  const stream = dealStream(deal.source, deal.stream);
  if (stream === "inbound") return renderWarmCall(deal, callbackNumber);
  if (stream === "introducer") return renderIntroducerCall(deal, "James Hale", callbackNumber);
  return renderSmeCall(deal, "James Hale", callbackNumber);
}

function cadenceView(stream: SalesStream) {
  return cadenceFor(stream).map((step) => ({
    day: step.day,
    touchId: step.touchId,
    channel: step.channel,
    job: step.job,
  }));
}

export const ENGAGEMENT_MODEL = {
  sme: cadenceView("sme"),
  introducer: cadenceView("introducer"),
  inbound: cadenceView("inbound"),
  cold: cadenceView("sme"),
};
