import { describe, it, expect } from "vitest";
import {
  AGENT_DIRECTORY,
  deskAgentForOutreach,
  knownMailbox,
  mailboxByAddress,
  mailboxForAgent,
  mailboxList,
  resolveSendAsMailbox,
} from "@shared/agentMailboxes";

describe("agent mailboxes", () => {
  it("gives every agent a unique person name and address", () => {
    const names = AGENT_DIRECTORY.map((row) => row.displayName);
    const locals = AGENT_DIRECTORY.map((row) => row.local);
    expect(new Set(names).size).toBe(AGENT_DIRECTORY.length);
    expect(new Set(locals).size).toBe(AGENT_DIRECTORY.length);
    expect(mailboxForAgent("outreach-sales").address).toBe("enquiries@stratafinance.co.uk");
    expect(mailboxForAgent("outreach-sales").displayName).toBe("James Hale");
    expect(mailboxForAgent("inbound-intake").role).toBe("New Business Administrator");
    expect(mailboxForAgent("outreach-sales").role).toBe("Business Consultant");
    expect(mailboxForAgent("deal-processing-underwriter").role).toBe("Process Manager");
    expect(mailboxForAgent("fulfilment-manager").role).toBe("New Business Manager");
    expect(mailboxForAgent("harvest").displayName).toBe("Harper Cole");
    expect(mailboxForAgent("harvest").role).toBe("Harvest Agent");
  });

  it("resolves an inbound address back to the agent", () => {
    expect(mailboxByAddress("sophie.reed@stratanexus.co.uk")?.agentId).toBe("fulfilment-manager");
    expect(mailboxByAddress("unknown@elsewhere.com")).toBeUndefined();
  });

  it("lists only the live IONOS inbox, not stratanexus aliases", () => {
    const list = mailboxList();
    expect(list).toHaveLength(1);
    expect(list[0].address).toBe("enquiries@stratafinance.co.uk");
    expect(list.some((row) => row.address.endsWith("@stratanexus.co.uk"))).toBe(false);
  });

  it("includes Shaun as a sendable Director identity", () => {
    expect(mailboxForAgent("director").displayName).toBe("Shaun Tuhey");
    expect(mailboxForAgent("director").role).toBe("Director");
    expect(mailboxForAgent("director").address).toBe("enquiries@stratafinance.co.uk");
    expect(knownMailbox("director")?.fromName).toBe("Shaun Tuhey · Director");
    expect(AGENT_DIRECTORY.find((row) => row.agentId === "director")?.mailOnly).toBe(true);
    expect(knownMailbox("no-such-desk")).toBeUndefined();
  });

  it("resolves send-as to the chosen desk and rejects unknown ids", () => {
    expect(resolveSendAsMailbox("inbound-intake", "outreach-sales").displayName).toBe("Maya Hart");
    expect(resolveSendAsMailbox(undefined, "outreach-sales").displayName).toBe("James Hale");
    expect(() => resolveSendAsMailbox("not-an-agent", "outreach-sales")).toThrow(/unknown send-as/i);
  });

  it("defaults hunt to James, inbound ack to Maya, inbound chase to Sophie", () => {
    expect(deskAgentForOutreach({ inbound: false })).toBe("outreach-sales");
    expect(deskAgentForOutreach({ inbound: true, touchId: "inbound_ack" })).toBe("inbound-intake");
    expect(deskAgentForOutreach({ inbound: true, touchId: "inbound_chase" })).toBe("fulfilment-manager");
  });
});
