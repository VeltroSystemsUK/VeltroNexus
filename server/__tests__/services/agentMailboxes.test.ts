import { describe, it, expect } from "vitest";
import { AGENT_DIRECTORY, mailboxByAddress, mailboxForAgent, mailboxList } from "@shared/agentMailboxes";

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
});
