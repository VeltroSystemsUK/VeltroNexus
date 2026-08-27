import { describe, expect, it } from "vitest";
import { coldEmailBlockedReason } from "@shared/pecrSend";
import { wasEmailDelivered, cadenceAfterOutreach } from "@shared/outreachSend";

describe("PECR at send time", () => {
  it("blocks cold email to a personal mailbox", () => {
    expect(coldEmailBlockedReason("director@gmail.com", "sme")).toMatch(/personal/i);
    expect(coldEmailBlockedReason("jane@hotmail.co.uk", "introducer")).toMatch(/personal/i);
  });

  it("allows a corporate mailbox on a hunt file and any mailbox on inbound", () => {
    expect(coldEmailBlockedReason("accounts@acmejoinery.co.uk", "sme")).toBeNull();
    expect(coldEmailBlockedReason("dave@gmail.com", "inbound")).toBeNull();
  });

  it("blocks send when there is no address", () => {
    expect(coldEmailBlockedReason(undefined, "sme")).toMatch(/no email/i);
  });
});

describe("email delivery vs mock", () => {
  it("does not treat a mock or failed send as delivered", () => {
    expect(wasEmailDelivered({ success: true, mock: true })).toBe(false);
    expect(wasEmailDelivered({ success: false, mock: true })).toBe(false);
    expect(wasEmailDelivered({ success: false })).toBe(false);
    expect(wasEmailDelivered(null)).toBe(false);
  });

  it("treats a real SMTP success as delivered", () => {
    expect(wasEmailDelivered({ success: true, messageId: "abc" })).toBe(true);
  });
});

describe("cadence after outreach", () => {
  it("holds the file when the auto-send did not actually leave the box", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: false,
        blockReason: null,
      })
    ).toBe("hold_undelivered");
  });

  it("holds LinkedIn for a human instead of starting the next timer", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: false,
        isLinkedIn: true,
        delivered: false,
        blockReason: null,
      })
    ).toBe("hold_linkedin");
  });

  it("holds on PECR rather than sending", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: false,
        blockReason: "personal mailbox — PECR",
      })
    ).toBe("hold_pecr");
  });

  it("advances after a real email send", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: true,
        blockReason: null,
      })
    ).toBe("advance");
  });
});
