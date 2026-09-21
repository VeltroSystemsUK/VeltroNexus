import { describe, expect, it } from "vitest";
import {
  annotateCrmLeads,
  applyHarvestToCrmLead,
  applyMailboxToCrmLead,
  campaignRecipientCountsAsContacted,
  emailsOnCrmLead,
  isCrmHarvestCandidate,
} from "@shared/crmLeadContact";

const lead = (over: Record<string, unknown> = {}) => ({
  id: 1,
  companyName: "North Peak Joinery",
  companyNumber: "01234567",
  email: "ops@northpeak.co.uk",
  contacts: [{ email: "adam@northpeak.co.uk" }],
  ...over,
});

const mail = (over: Record<string, unknown> = {}) => ({
  direction: "outbound",
  status: "sent",
  to: "ops@northpeak.co.uk",
  ...over,
});

const recipient = (over: Record<string, unknown> = {}) => ({
  email: "ops@northpeak.co.uk",
  status: "sent",
  ...over,
});

describe("emailsOnCrmLead", () => {
  it("collects the card email and contact emails, including JSON contacts", () => {
    expect(emailsOnCrmLead(lead())).toEqual(["ops@northpeak.co.uk", "adam@northpeak.co.uk"]);
    expect(
      emailsOnCrmLead(lead({ contacts: JSON.stringify([{ email: "jane@northpeak.co.uk" }]) })),
    ).toEqual(["ops@northpeak.co.uk", "jane@northpeak.co.uk"]);
  });
});

describe("campaignRecipientCountsAsContacted", () => {
  it("counts a send that left the building, not pending or failed", () => {
    expect(campaignRecipientCountsAsContacted("sent")).toBe(true);
    expect(campaignRecipientCountsAsContacted("delivered")).toBe(true);
    expect(campaignRecipientCountsAsContacted("opened")).toBe(true);
    expect(campaignRecipientCountsAsContacted("clicked")).toBe(true);
    expect(campaignRecipientCountsAsContacted("unsubscribed")).toBe(true);
    expect(campaignRecipientCountsAsContacted("bounced")).toBe(true);
    expect(campaignRecipientCountsAsContacted("pending")).toBe(false);
    expect(campaignRecipientCountsAsContacted("failed")).toBe(false);
  });
});

describe("annotateCrmLeads", () => {
  it("marks a lead contacted from Agent Mail sent to the card or a contact email", () => {
    const [row] = annotateCrmLeads([lead()], { mail: [mail()], recipients: [], suppression: [] });
    expect(row.contacted).toBe(true);
    expect(row.doNotContact).toBe(false);

    const [viaContact] = annotateCrmLeads([lead({ email: "other@northpeak.co.uk" })], {
      mail: [mail({ to: "Adam Peak <adam@northpeak.co.uk>" })],
      recipients: [],
      suppression: [],
    });
    expect(viaContact.contacted).toBe(true);
  });

  it("treats mock Agent Mail as contacted and ignores inbound or failed outbound", () => {
    const [mocked] = annotateCrmLeads([lead()], {
      mail: [mail({ status: "mock" })],
      recipients: [],
      suppression: [],
    });
    expect(mocked.contacted).toBe(true);

    const [inbound] = annotateCrmLeads([lead()], {
      mail: [mail({ direction: "inbound", status: "received" })],
      recipients: [],
      suppression: [],
    });
    expect(inbound.contacted).toBe(false);

    const [failed] = annotateCrmLeads([lead()], {
      mail: [mail({ status: "failed" })],
      recipients: [],
      suppression: [],
    });
    expect(failed.contacted).toBe(false);
  });

  it("marks a lead contacted from a campaign send to that email", () => {
    const [row] = annotateCrmLeads([lead()], {
      mail: [],
      recipients: [recipient({ status: "opened" })],
      suppression: [],
    });
    expect(row.contacted).toBe(true);

    const [pending] = annotateCrmLeads([lead()], {
      mail: [],
      recipients: [recipient({ status: "pending" })],
      suppression: [],
    });
    expect(pending.contacted).toBe(false);
  });

  it("flags do-not-contact from suppression, campaign unsubscribe, and never-contact", () => {
    const [suppressed] = annotateCrmLeads([lead()], {
      mail: [],
      recipients: [],
      suppression: [{ email: "ops@northpeak.co.uk", companyNumber: "01234567", reason: "opt-out", at: "2026-09-10" }],
    });
    expect(suppressed.doNotContact).toBe(true);

    const [byNumber] = annotateCrmLeads([lead({ email: "fresh@other.co.uk", contacts: [] })], {
      mail: [],
      recipients: [],
      suppression: [{ email: "old@northpeak.co.uk", companyNumber: "01234567", reason: "opt-out", at: "2026-09-10" }],
    });
    expect(byNumber.doNotContact).toBe(true);

    const [unsub] = annotateCrmLeads([lead()], {
      mail: [],
      recipients: [recipient({ status: "unsubscribed" })],
      suppression: [],
    });
    expect(unsub.doNotContact).toBe(true);
    expect(unsub.contacted).toBe(true);

    const [never] = annotateCrmLeads(
      [lead({ email: "admin@musicindustrygroup.com", companyNumber: "OC421480", contacts: [] })],
      { mail: [], recipients: [], suppression: [] },
    );
    expect(never.doNotContact).toBe(true);
  });

  it("leaves an untouched lead unmarked", () => {
    const [row] = annotateCrmLeads([lead()], { mail: [], recipients: [], suppression: [] });
    expect(row.contacted).toBe(false);
    expect(row.doNotContact).toBe(false);
    expect(row.companyName).toBe("North Peak Joinery");
  });

  it("marks a hard-bounced mailbox as bounced, not do-not-contact", () => {
    const [row] = annotateCrmLeads([lead()], {
      mail: [mail()],
      recipients: [],
      suppression: [{ email: "ops@northpeak.co.uk", reason: "hard bounce — wasn't found", at: "2026-09-10" }],
    });
    expect(row.bounced).toBe(true);
    expect(row.doNotContact).toBe(false);
    expect(row.bounceReason).toMatch(/wasn't found/i);
    expect(row.contacted).toBe(true);
  });

  it("does not paint the rest of the company after a hard bounce", () => {
    const [row] = annotateCrmLeads([lead({ email: "accounts@northpeak.co.uk", contacts: [] })], {
      mail: [],
      recipients: [],
      suppression: [{
        email: "ops@northpeak.co.uk",
        companyNumber: "01234567",
        reason: "hard bounce — address does not exist",
        at: "2026-09-10",
      }],
    });
    expect(row.bounced).toBe(false);
    expect(row.doNotContact).toBe(false);
  });
});

describe("applyMailboxToCrmLead", () => {
  it("sets a harvested mailbox as the card email when Clients has none", () => {
    const next = applyMailboxToCrmLead(lead({ email: undefined, contacts: [] }), {
      email: "info@pdfiresafety.com",
      contactName: "Pat Fire",
    });
    expect(next.changed).toBe(true);
    expect(next.email).toBe("info@pdfiresafety.com");
    expect(next.contactName).toBe("Pat Fire");
    expect(emailsOnCrmLead({ ...lead({ email: undefined, contacts: [] }), ...next })).toContain(
      "info@pdfiresafety.com",
    );
  });

  it("keeps an existing card email and adds the harvested mailbox as a contact", () => {
    const next = applyMailboxToCrmLead(lead({ email: "ops@northpeak.co.uk", contacts: [] }), {
      email: "ada@northpeak.co.uk",
      contactName: "Ada Peak",
    });
    expect(next.changed).toBe(true);
    expect(next.email).toBe("ops@northpeak.co.uk");
    expect(next.contacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: "ada@northpeak.co.uk", name: "Ada Peak" })]),
    );
  });

  it("is a no-op when the mailbox is already on the card", () => {
    const next = applyMailboxToCrmLead(lead(), { email: "ops@northpeak.co.uk" });
    expect(next.changed).toBe(false);
    expect(next.email).toBe("ops@northpeak.co.uk");
  });

  it("is a no-op when the mailbox is already a contact, including JSON contacts", () => {
    const next = applyMailboxToCrmLead(
      lead({ contacts: JSON.stringify([{ email: "adam@northpeak.co.uk" }]) }),
      { email: "Adam Peak <adam@northpeak.co.uk>" },
    );
    expect(next.changed).toBe(false);
  });

  it("ignores a blank or invalid mailbox", () => {
    expect(applyMailboxToCrmLead(lead({ email: undefined, contacts: [] }), { email: "" }).changed).toBe(false);
    expect(applyMailboxToCrmLead(lead({ email: undefined, contacts: [] }), { email: "not-an-email" }).changed).toBe(
      false,
    );
  });

  it("lets annotateCrmLeads mark the card contacted after the mailbox is written back", () => {
    const blank = lead({ email: undefined, contacts: [] });
    const next = applyMailboxToCrmLead(blank, { email: "info@pdfiresafety.com" });
    const [row] = annotateCrmLeads([{ ...blank, email: next.email, contacts: next.contacts }], {
      mail: [mail({ to: "info@pdfiresafety.com" })],
      recipients: [],
      suppression: [],
    });
    expect(row.contacted).toBe(true);
  });
});

describe("isCrmHarvestCandidate", () => {
  it("selects a Clients lead with a company number and no mailbox", () => {
    expect(
      isCrmHarvestCandidate(lead({ email: undefined, contacts: [], companyNumber: "01234567" })),
    ).toBe(true);
  });

  it("skips leads that already have a mailbox, no company number, or do-not-contact", () => {
    expect(isCrmHarvestCandidate(lead())).toBe(false);
    expect(isCrmHarvestCandidate(lead({ email: undefined, contacts: [], companyNumber: "" }))).toBe(false);
    expect(
      isCrmHarvestCandidate(
        lead({ email: undefined, contacts: [], companyNumber: "01234567", doNotContact: true }),
      ),
    ).toBe(false);
  });

  it("still hunts after a hard bounce, but not while waiting or after the attach cap", () => {
    expect(
      isCrmHarvestCandidate(lead({ bounced: true })),
    ).toBe(true);
    expect(
      isCrmHarvestCandidate(lead({ email: undefined, contacts: [] }), { attempts: 6 }),
    ).toBe(false);
    expect(
      isCrmHarvestCandidate(lead({ email: undefined, contacts: [] }), {
        waitUntil: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("applyHarvestToCrmLead", () => {
  it("writes directors as contacts and the harvested mailbox onto a blank Clients card", () => {
    const next = applyHarvestToCrmLead(lead({ email: undefined, contactName: undefined, contacts: [] }), {
      email: "ada@northpeak.co.uk",
      contactName: "Ada Lovelace",
      directorNames: ["Ada Lovelace", "Charles Babbage"],
      website: "https://northpeak.co.uk",
      phone: "0121 000 0000",
    });
    expect(next.changed).toBe(true);
    expect(next.email).toBe("ada@northpeak.co.uk");
    expect(next.contactName).toBe("Ada Lovelace");
    expect(next.website).toBe("https://northpeak.co.uk");
    expect(next.phone).toBe("0121 000 0000");
    expect(next.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Ada Lovelace", role: "Director" }),
        expect.objectContaining({ name: "Charles Babbage", role: "Director" }),
      ]),
    );
  });

  it("does not duplicate directors already on the card", () => {
    const next = applyHarvestToCrmLead(
      lead({
        email: undefined,
        contacts: [{ name: "Ada Lovelace", role: "Director" }],
      }),
      { directorNames: ["Ada Lovelace"] },
    );
    expect(next.contacts.filter((row) => /ada lovelace/i.test(row.name || ""))).toHaveLength(1);
  });
});
