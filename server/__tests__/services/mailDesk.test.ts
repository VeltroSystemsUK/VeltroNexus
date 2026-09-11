import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    listAgenticDeals: vi.fn(),
    deleteAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
  },
}));

vi.mock("../../services/mailSuppression", () => ({
  addSuppression: vi.fn(),
  loadSuppression: vi.fn(() => []),
}));

vi.mock("../../services/openers", () => ({
  stopOpenerNurtureByEmail: vi.fn(),
  suppressionFanoutForEmail: vi.fn((email: string) => ({ emails: [email] })),
  deleteOpenerByEmail: vi.fn(),
  markOpenerNurturingOnOutbound: vi.fn(),
  upsertOpenerFromMail: vi.fn(),
  autoPromoteEligibleOpeners: vi.fn(async () => []),
}));

import { storage } from "../../storage";
import { addSuppression } from "../../services/mailSuppression";
import { deleteOpenerByEmail } from "../../services/openers";
import {
  clearAgentMail,
  listAgentMail,
  logAgentMail,
  patchAgentMail,
  setAgentMailStorePathForTests,
} from "../../services/agentMailLog";
import { applyMailDesk, processAgentInbox } from "../../services/mailDesk";

const mockedStorage = storage as unknown as {
  listAgenticDeals: ReturnType<typeof vi.fn>;
  deleteAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
};

const deal = {
  id: 42,
  email: "marcus.fisk@theundergroundbakery.co.uk",
  companyName: "Underground Bakery Ltd",
  companyNumber: "01234567",
  events: [] as Array<{ message?: string }>,
};

function tmpMailStore() {
  const file = path.join(os.tmpdir(), `agent-mail-desk-${process.pid}-${Date.now()}.json`);
  setAgentMailStorePathForTests(file);
  return file;
}

beforeEach(() => {
  tmpMailStore();
  mockedStorage.listAgenticDeals.mockResolvedValue([deal]);
  mockedStorage.deleteAgenticDeal.mockResolvedValue(undefined);
  mockedStorage.updateAgenticDeal.mockResolvedValue({ ...deal });
});

afterEach(() => {
  clearAgentMail();
  setAgentMailStorePathForTests(null);
  vi.clearAllMocks();
});

describe("applyMailDesk hard bounce", () => {
  it("keeps the deal, strips the dead mailbox, and queues Harper", async () => {
    const item = logAgentMail({
      direction: "inbound",
      from: "postmaster@netorgft5702276.onmicrosoft.com",
      to: "enquiries@stratafinance.co.uk",
      subject: "Undeliverable: Restructuring Underground Bakery’s monthly debt commitments",
      text: "Your message to marcus.fisk@theundergroundbakery.co.uk couldn't be delivered.\nmarcus.fisk wasn't found at theundergroundbakery.co.uk.\nUnknown To address",
      status: "received",
    });

    const result = await applyMailDesk(item);

    expect(result.kind).toBe("bounce");
    expect(listAgentMail()).toEqual([]);
    expect(mockedStorage.deleteAgenticDeal).not.toHaveBeenCalled();
    expect(mockedStorage.updateAgenticDeal).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ email: "", hopper: "hunt_contact" }),
    );
    expect(addSuppression).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "marcus.fisk@theundergroundbakery.co.uk",
        reason: expect.stringMatching(/hard bounce/i),
      })
    );
    expect((addSuppression as ReturnType<typeof vi.fn>).mock.calls[0][0].companyNumber).toBeFalsy();
    expect(deleteOpenerByEmail).toHaveBeenCalledWith("marcus.fisk@theundergroundbakery.co.uk");
  });

  it("leaves mailbox-full bounces on file instead of deleting", async () => {
    const item = logAgentMail({
      direction: "inbound",
      from: "mailer-daemon@s12.tarhelyadmin.com",
      to: "enquiries@stratafinance.co.uk",
      subject: "Mail delivery failed: returning message to sender",
      text: "This is a permanent error. The following address(es) failed:\n\n  mail@gopkft.com\n    LMTP error after RCPT TO:<mail@gopkft.com>: 452 4.2.2 Mailbox is full",
      status: "received",
    });
    mockedStorage.listAgenticDeals.mockResolvedValue([
      { ...deal, id: 7, email: "mail@gopkft.com" },
    ]);

    const result = await applyMailDesk(item);

    expect(result.kind).toBe("bounce");
    expect(listAgentMail()).toHaveLength(1);
    expect(mockedStorage.deleteAgenticDeal).not.toHaveBeenCalled();
    expect(mockedStorage.updateAgenticDeal).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ status: "waiting_human" })
    );
  });
});

describe("processAgentInbox hard bounce backfill", () => {
  it("strips the dead mailbox on already-classified hard bounces and queues Harper", async () => {
    const item = logAgentMail({
      direction: "inbound",
      from: "mailer-daemon@kundenserver.de",
      to: "enquiries@stratafinance.co.uk",
      subject: "Mail delivery failed: returning message to sender",
      text: "The following recipient address(es) could not be reached:\n\n* info@theboardroombristol.com\n\nThe email address may no longer exist",
      status: "received",
    });
    patchAgentMail(item.id, {
      deskKind: "bounce",
      deskNote: "hard bounce — address does not exist · info@theboardroombristol.com",
    });
    mockedStorage.listAgenticDeals.mockResolvedValue([
      { ...deal, id: 9, email: "info@theboardroombristol.com" },
    ]);

    await processAgentInbox();

    expect(listAgentMail()).toEqual([]);
    expect(mockedStorage.deleteAgenticDeal).not.toHaveBeenCalled();
    expect(mockedStorage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ email: "", hopper: "hunt_contact" }),
    );
  });
});
