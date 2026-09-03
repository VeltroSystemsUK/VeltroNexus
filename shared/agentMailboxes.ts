function readEnv(name: string): string | undefined {
  try {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

export const MAIL_DOMAIN = readEnv("MAIL_DOMAIN") || "stratanexus.co.uk";

export type AgentMailbox = {
  agentId: string;
  displayName: string;
  role: string;
  local: string;
  address: string;
  fromName: string;
  replyTo: string;
};

function addr(local: string): string {
  return `${local}@${MAIL_DOMAIN}`;
}

export const AGENT_DIRECTORY: Array<{
  agentId: string;
  displayName: string;
  role: string;
  local: string;
}> = [
  { agentId: "inbound-intake", displayName: "Maya Hart", role: "New Business Administrator", local: "maya.hart" },
  { agentId: "contact-finder", displayName: "Elena Ward", role: "Contact Finder", local: "elena.ward" },
  { agentId: "harvest", displayName: "Harper Cole", role: "Harvest Agent", local: "harper.cole" },
  { agentId: "database-builder", displayName: "Daniel Crowe", role: "Client Agent", local: "daniel.crowe" },
  { agentId: "database-builder-se", displayName: "Tom Brennan", role: "Refer Agent", local: "tom.brennan" },
  { agentId: "outreach-sales", displayName: "James Hale", role: "Business Consultant", local: "james.hale" },
  { agentId: "fulfilment-manager", displayName: "Sophie Reed", role: "New Business Manager", local: "sophie.reed" },
  { agentId: "mailbox-clerk", displayName: "Rowan Vale", role: "Inbox Agent", local: "rowan.vale" },
  { agentId: "deal-processing-underwriter", displayName: "Priya Shah", role: "Process Manager", local: "priya.shah" },
  { agentId: "accounts-monitor", displayName: "Oliver Grant", role: "Finance Monitor", local: "oliver.grant" },
  { agentId: "capital-strategist", displayName: "Nathan Cole", role: "Capital Strategist", local: "nathan.cole" },
];

export function sharedInbox(): string {
  return readEnv("MAIL_REPLY_TO") || "enquiries@stratafinance.co.uk";
}

// Inbound enquiries (ack + chase) go out under the shared enquiries@stratafinance.co.uk
// address rather than the agent's personal @stratanexus.co.uk mailbox — keeps the human
// signature (name/role) but points replies at the shared inbound inbox.
export function inboundMailbox(agentId?: string): AgentMailbox {
  const base = mailboxForAgent(agentId);
  const address = sharedInbox();
  return { ...base, address, replyTo: address };
}

// All agents send/reply through the shared enquiries@stratafinance.co.uk IONOS
// mailbox — IONOS only allows sending From the authenticated mailbox, so
// per-agent @stratanexus.co.uk addresses can no longer be the envelope
// sender. The agent's name/role still shows as the display name.
export function mailboxForAgent(agentId?: string): AgentMailbox {
  const row = AGENT_DIRECTORY.find((item) => item.agentId === agentId) || AGENT_DIRECTORY.find((item) => item.agentId === "outreach-sales")!;
  const address = sharedInbox();
  return {
    agentId: row.agentId,
    displayName: row.displayName,
    role: row.role,
    local: row.local,
    address,
    fromName: `${row.displayName} · ${row.role}`,
    replyTo: address,
  };
}

export function mailboxByAddress(email?: string): AgentMailbox | undefined {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return undefined;
  const local = target.split("@")[0];
  const row = AGENT_DIRECTORY.find((item) => item.local === local || addr(item.local).toLowerCase() === target);
  return row ? mailboxForAgent(row.agentId) : undefined;
}

export function mailboxList() {
  const address = sharedInbox();
  const host = process.env.SMTP_HOST || "smtp.ionos.co.uk";
  return [
    {
      role: "Agent inbox",
      address,
      use: `IONOS ${host}. Every desk sends from this mailbox. The display name is the desk. Replies come back here.`,
    },
  ];
}
