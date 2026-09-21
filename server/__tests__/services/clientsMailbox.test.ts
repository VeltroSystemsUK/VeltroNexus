import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getInternalLeadByCompanyNumber: vi.fn(),
    updateInternalLead: vi.fn(),
    getAgenticDeal: vi.fn(),
    listInternalLeads: vi.fn(),
    listAgenticDeals: vi.fn(),
  },
}));

vi.mock("../../services/agentMailLog", () => ({
  listAgentMail: vi.fn(),
}));

import { storage } from "../../storage";
import { listAgentMail } from "../../services/agentMailLog";
import {
  backfillClientMailboxesFromMail,
  writeMailboxToClients,
  writeMailboxToClientsFromDeal,
} from "../../services/clientsMailbox";

const mocked = storage as unknown as {
  getInternalLeadByCompanyNumber: ReturnType<typeof vi.fn>;
  updateInternalLead: ReturnType<typeof vi.fn>;
  getAgenticDeal: ReturnType<typeof vi.fn>;
  listInternalLeads: ReturnType<typeof vi.fn>;
  listAgenticDeals: ReturnType<typeof vi.fn>;
};

const lead = {
  id: 9,
  companyName: "PDFS FIRE AND SAFETY LTD",
  companyNumber: "12345678",
  email: undefined,
  contactName: undefined,
  contacts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.updateInternalLead.mockImplementation(async (_id: number, patch: Record<string, unknown>) => ({
    ...lead,
    ...patch,
  }));
});

describe("writeMailboxToClients", () => {
  it("writes a harvested mailbox onto the Clients card for that company number", async () => {
    mocked.getInternalLeadByCompanyNumber.mockResolvedValue(lead);

    const updated = await writeMailboxToClients({
      companyNumber: "12345678",
      email: "info@pdfiresafety.com",
      contactName: "Pat Fire",
    });

    expect(updated).toBe(true);
    expect(mocked.updateInternalLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "info@pdfiresafety.com",
        contactName: "Pat Fire",
      }),
    );
  });

  it("does not invent a Clients card when the company is not on the book", async () => {
    mocked.getInternalLeadByCompanyNumber.mockResolvedValue(undefined);
    expect(await writeMailboxToClients({ companyNumber: "00000000", email: "a@b.co.uk" })).toBe(false);
    expect(mocked.updateInternalLead).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing card email", async () => {
    mocked.getInternalLeadByCompanyNumber.mockResolvedValue({
      ...lead,
      email: "ops@pdfiresafety.com",
    });
    await writeMailboxToClients({ companyNumber: "12345678", email: "info@pdfiresafety.com" });
    expect(mocked.updateInternalLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "ops@pdfiresafety.com",
        contacts: [expect.objectContaining({ email: "info@pdfiresafety.com" })],
      }),
    );
  });
});

describe("writeMailboxToClientsFromDeal", () => {
  it("looks up the deal company number then writes the send address", async () => {
    mocked.getAgenticDeal.mockResolvedValue({
      id: 5516,
      companyNumber: "12345678",
      contactName: "Pat Fire",
    });
    mocked.getInternalLeadByCompanyNumber.mockResolvedValue(lead);

    await writeMailboxToClientsFromDeal(5516, "info@pdfiresafety.com");

    expect(mocked.getAgenticDeal).toHaveBeenCalledWith(5516);
    expect(mocked.updateInternalLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ email: "info@pdfiresafety.com" }),
    );
  });
});

describe("backfillClientMailboxesFromMail", () => {
  it("writes sent hopper mailboxes onto matching Clients cards", async () => {
    (listAgentMail as ReturnType<typeof vi.fn>).mockReturnValue([
      { direction: "outbound", status: "sent", to: "info@pdfiresafety.com", dealId: 5516 },
      { direction: "outbound", status: "failed", to: "skip@nope.co.uk", dealId: 1 },
    ]);
    mocked.listAgenticDeals.mockResolvedValue([
      { id: 5516, companyNumber: "12345678", contactName: "Pat Fire", email: "info@pdfiresafety.com" },
    ]);
    mocked.listInternalLeads.mockResolvedValue([lead]);

    const result = await backfillClientMailboxesFromMail();

    expect(result).toEqual({ scanned: 1, updated: 1 });
    expect(mocked.updateInternalLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ email: "info@pdfiresafety.com" }),
    );
  });

  it("keeps both send addresses when two hopper mails hit the same Clients card", async () => {
    (listAgentMail as ReturnType<typeof vi.fn>).mockReturnValue([
      { direction: "outbound", status: "sent", to: "info@pdfiresafety.com", dealId: 5516 },
      { direction: "outbound", status: "sent", to: "pat@pdfiresafety.com", dealId: 5516 },
    ]);
    mocked.listAgenticDeals.mockResolvedValue([
      { id: 5516, companyNumber: "12345678", contactName: "Pat Fire", email: "info@pdfiresafety.com" },
    ]);
    mocked.listInternalLeads.mockResolvedValue([lead]);

    await backfillClientMailboxesFromMail();

    expect(mocked.updateInternalLead).toHaveBeenCalledTimes(1);
    expect(mocked.updateInternalLead).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        email: "info@pdfiresafety.com",
        contacts: [expect.objectContaining({ email: "pat@pdfiresafety.com" })],
      }),
    );
  });
});
