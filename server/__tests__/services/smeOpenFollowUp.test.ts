import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    getSystemSetting: vi.fn(),
    listAgenticDeals: vi.fn(),
  },
}));

vi.mock("../../services/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../services/mailDesk", () => ({
  mailIsSuppressed: () => false,
}));

vi.mock("../../services/agentMailLog", () => ({
  listAgentMail: vi.fn(() => []),
}));

import { storage } from "../../storage";
import { sendEmail } from "../../services/email";
import { listAgentMail } from "../../services/agentMailLog";
import { maybeSendSmeFollowUp, maybeSendSmeOpenFollowUp, sendDueSmeFollowUps } from "../../services/smeOpenFollowUp";
import type { AgentMailItem } from "../../services/agentMailLog";

const mockedStorage = storage as unknown as {
  getAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
  getSystemSetting: ReturnType<typeof vi.fn>;
  listAgenticDeals: ReturnType<typeof vi.fn>;
};
const mockedListAgentMail = listAgentMail as unknown as ReturnType<typeof vi.fn>;
const mockedSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;

const deal = {
  id: 42,
  email: "ops@acmejoinery.co.uk",
  companyName: "Acme Joinery Limited",
  contactName: "David Cole",
  source: "distress_scan" as const,
  stream: "sme" as const,
  stage: "fulfilment" as const,
  status: "waiting_timer" as const,
  outreachTouch: 1,
  outreachTouchId: "sme_1",
  events: [] as Array<{ message?: string }>,
  prospectId: 9,
};

const sme1Mail: AgentMailItem = {
  id: "mail-1",
  direction: "outbound",
  status: "sent",
  touchId: "sme_1",
  opens: ["2026-09-03T10:00:00.000Z"],
  dealId: 42,
  subject: "Restructuring Acme Joinery Limited’s monthly debt commitments",
  messageId: "<sme-1@test>",
  from: "enquiries@stratafinance.co.uk",
  to: "ops@acmejoinery.co.uk",
  text: "hello",
  createdAt: "2026-09-03T09:00:00.000Z",
};

describe("maybeSendSmeOpenFollowUp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedStorage.getAgenticDeal.mockResolvedValue(deal);
    mockedStorage.updateAgenticDeal.mockImplementation(async (_id: number, updates: object) => ({
      ...deal,
      ...updates,
    }));
    mockedStorage.getSystemSetting.mockResolvedValue({});
    mockedStorage.listAgenticDeals.mockResolvedValue([deal]);
    mockedListAgentMail.mockReturnValue([sme1Mail]);
    mockedSendEmail.mockResolvedValue({ success: true, messageId: "<sme-open@test>" });
  });

  it("sends the quiz follow-up in-thread without advancing the cadence", async () => {
    const sent = await maybeSendSmeOpenFollowUp(sme1Mail);
    expect(sent).toBe(true);
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [credentials, to, subject, html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe("ops@acmejoinery.co.uk");
    expect(subject).toBe("Re: Restructuring Acme Joinery Limited’s monthly debt commitments");
    expect(credentials.touchId).toBe("sme_open");
    expect(credentials.inReplyTo).toBe("<sme-1@test>");
    expect(html).toMatch(/explore\.stratanexus\.co\.uk/);
    expect(html).toMatch(/four-question assessment/i);
    const patches = mockedStorage.updateAgenticDeal.mock.calls.map(([, updates]) => updates);
    expect(patches.some((patch) => patch.outreachTouch !== undefined)).toBe(false);
    expect(patches.some((patch) => patch.smeOpenFollowUpSentAt)).toBe(true);
  });

  it("does not send when a later cadence email is opened", async () => {
    const sent = await maybeSendSmeOpenFollowUp({ ...sme1Mail, touchId: "sme_2" });
    expect(sent).toBe(false);
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const dueDeal = { ...deal, smeOpenFollowUpSentAt: twoDaysAgo };

describe("maybeSendSmeFollowUp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedStorage.getAgenticDeal.mockResolvedValue(dueDeal);
    mockedStorage.updateAgenticDeal.mockImplementation(async (_id: number, updates: object) => ({
      ...dueDeal,
      ...updates,
    }));
    mockedStorage.getSystemSetting.mockResolvedValue({});
    mockedStorage.listAgenticDeals.mockResolvedValue([dueDeal]);
    mockedListAgentMail.mockReturnValue([sme1Mail]);
    mockedSendEmail.mockResolvedValue({ success: true, messageId: "<sme-followup@test>" });
  });

  it("sends Learn in-thread two days after sme_open without advancing the cadence", async () => {
    const sent = await maybeSendSmeFollowUp(42);
    expect(sent).toBe(true);
    const [credentials, to, subject, html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe("ops@acmejoinery.co.uk");
    expect(subject).toBe("Re: Restructuring Acme Joinery Limited’s monthly debt commitments");
    expect(credentials.touchId).toBe("sme_followup");
    expect(credentials.inReplyTo).toBe("<sme-1@test>");
    expect(html).toMatch(/learn\.stratanexus\.co\.uk/);
    expect(html).toMatch(/Open Strata Learn/);
    expect(html).not.toMatch(/explore\.stratanexus\.co\.uk/);
    const patches = mockedStorage.updateAgenticDeal.mock.calls.map(([, updates]) => updates);
    expect(patches.some((patch) => patch.outreachTouch !== undefined)).toBe(false);
    expect(patches.some((patch) => patch.smeFollowupSentAt)).toBe(true);
  });

  it("does not send when they have already submitted Explore", async () => {
    mockedStorage.listAgenticDeals.mockResolvedValue([
      dueDeal,
      { id: 99, source: "strata_inbound", email: "ops@acmejoinery.co.uk", companyNumber: "99999999" },
    ]);
    const sent = await maybeSendSmeFollowUp(42);
    expect(sent).toBe(false);
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe("sendDueSmeFollowUps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedStorage.getAgenticDeal.mockResolvedValue(dueDeal);
    mockedStorage.updateAgenticDeal.mockImplementation(async (_id: number, updates: object) => ({
      ...dueDeal,
      ...updates,
    }));
    mockedStorage.getSystemSetting.mockResolvedValue({});
    mockedListAgentMail.mockReturnValue([sme1Mail]);
    mockedSendEmail.mockResolvedValue({ success: true, messageId: "<sme-followup@test>" });
  });

  it("sends due Learn mails and skips files that are not yet two days old", async () => {
    const fresh = { ...deal, id: 43, smeOpenFollowUpSentAt: new Date().toISOString() };
    mockedStorage.listAgenticDeals.mockResolvedValue([dueDeal, fresh]);
    mockedStorage.getAgenticDeal.mockImplementation(async (id: number) => (id === 42 ? dueDeal : fresh));
    const result = await sendDueSmeFollowUps();
    expect(result.candidates).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });
});
