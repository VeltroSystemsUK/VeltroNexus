export type MailForSalesActivity = {
  direction?: string;
  status?: string;
  createdAt?: string | Date | null;
  opens?: string[];
  clicks?: Array<{ at: string; url: string }>;
};

export type InboundLeadForReport = {
  companyName: string;
  contactName?: string | null;
  createdAt?: string | Date | null;
};

export type InboundProspectLine = {
  companyName: string;
  contactName?: string | null;
};

export type WeeklySalesActivity = {
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  repliesReceived: number;
  inboundProspects: InboundProspectLine[];
};

export const PROGRESS_SUMMARY_SYSTEM =
  "You write concise weekly progress summaries for a commercial-finance JV. Stick to the facts given. Cover what was done, why, and the benefit. To the point, no fluff, no invented details.";

function inRange(value: string | Date | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

export function summarizeWeeklySalesActivity(input: {
  mail: MailForSalesActivity[];
  inboundLeads: InboundLeadForReport[];
  weekStart: Date;
  weekEnd: Date;
}): WeeklySalesActivity {
  const weekMail = input.mail.filter((item) => inRange(item.createdAt, input.weekStart, input.weekEnd));
  const outbound = weekMail.filter((item) => item.direction === "outbound" && item.status === "sent");
  return {
    emailsSent: outbound.length,
    emailsOpened: outbound.filter((item) => (item.opens || []).length > 0).length,
    linksClicked: outbound.filter((item) => (item.clicks || []).length > 0).length,
    repliesReceived: weekMail.filter((item) => item.direction === "inbound").length,
    inboundProspects: input.inboundLeads
      .filter((lead) => inRange(lead.createdAt, input.weekStart, input.weekEnd))
      .map((lead) => ({
        companyName: lead.companyName,
        contactName: lead.contactName || undefined,
      })),
  };
}

export function formatInboundProspectLine(prospect: InboundProspectLine): string {
  const contact = (prospect.contactName || "").trim();
  return contact ? `${prospect.companyName} — ${contact}` : prospect.companyName;
}

export function salesActivityTableRows(sales: WeeklySalesActivity): string[][] {
  return [
    ["Emails sent", String(sales.emailsSent)],
    ["Emails opened", String(sales.emailsOpened)],
    ["Links clicked", String(sales.linksClicked)],
    ["Replies received", String(sales.repliesReceived)],
    ["Inbound website prospects", String(sales.inboundProspects.length)],
  ];
}

export function buildProgressSummaryPrompt(input: {
  weekNumber: number;
  completedPlanned: string[];
  completedExtra: string[];
  sales: WeeklySalesActivity;
}): string {
  const planned = input.completedPlanned.length
    ? input.completedPlanned.map((t) => `- ${t}`).join("\n")
    : "(none)";
  const extra = input.completedExtra.length
    ? input.completedExtra.map((t) => `- ${t}`).join("\n")
    : "(none)";
  const inbound = input.sales.inboundProspects.length
    ? input.sales.inboundProspects.map((p) => `- ${formatInboundProspectLine(p)}`).join("\n")
    : "(none)";

  return [
    `Write the Week ${input.weekNumber} progress summary for the Strata Finance / Veltro JV.`,
    "",
    "Completed planned tasks:",
    planned,
    "",
    "Additional unplanned activity:",
    extra,
    "",
    "Sales activity this week:",
    `- Emails sent: ${input.sales.emailsSent}`,
    `- Emails opened: ${input.sales.emailsOpened}`,
    `- Links clicked: ${input.sales.linksClicked}`,
    `- Replies received: ${input.sales.repliesReceived}`,
    "",
    "Inbound prospects from stratafinance.co.uk:",
    inbound,
    "",
    "Write 2–4 short sentences covering: what was done, why it was done, and what the benefit will be.",
    "Be to the point and informative. Do not invent facts not listed above. Do not mention AI.",
  ].join("\n");
}

export function fallbackProgressSummary(input: {
  weekNumber: number;
  completedPlanned: string[];
  completedExtra: string[];
  sales: WeeklySalesActivity;
}): string {
  const tasks = [...input.completedPlanned, ...input.completedExtra];
  const taskBit = tasks.length
    ? `Completed ${tasks.length === 1 ? "1 item" : `${tasks.length} items`} including ${tasks[0]}.`
    : "No board tasks were marked done.";
  const sales = input.sales;
  const salesBit = `The sales desk sent ${sales.emailsSent} emails (${sales.emailsOpened} opened, ${sales.linksClicked} clicked) and received ${sales.repliesReceived} ${sales.repliesReceived === 1 ? "reply" : "replies"}.`;
  const inboundBit = sales.inboundProspects.length
    ? `Inbound from stratafinance.co.uk: ${sales.inboundProspects.map(formatInboundProspectLine).join("; ")}.`
    : "No inbound prospects arrived via stratafinance.co.uk.";
  return `${taskBit} ${salesBit} ${inboundBit} That keeps the live book moving and gives next week a clearer pipeline.`.trim();
}
