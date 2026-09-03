import { describe, expect, it } from "vitest";
import { injectMailTracking } from "../../services/agentMailLog";
import { isOpenedOutboundMail, lastMailOpenAt, shouldRecordMailTracking, stripMailTracking } from "@shared/mailTracking";

describe("stripMailTracking", () => {
  it("removes the open pixel and restores original links", () => {
    const html = injectMailTracking(
      `<p>Hi <a href="https://stratafinance.co.uk/pack">upload</a>.</p></body>`,
      "TEST-ID-123",
    );
    expect(html).toMatch(/\/api\/agent-mail\/track\/TEST-ID-123\.gif/);
    expect(html).toMatch(/\/api\/agent-mail\/click\/TEST-ID-123/);

    const preview = stripMailTracking(html);
    expect(preview).not.toMatch(/\/api\/agent-mail\/track\//);
    expect(preview).not.toMatch(/\/api\/agent-mail\/click\//);
    expect(preview).toContain('href="https://stratafinance.co.uk/pack"');
    expect(preview).toContain("Hi");
  });
});

describe("shouldRecordMailTracking", () => {
  it("does not record opens from a logged-in Nexus session", () => {
    expect(shouldRecordMailTracking({ staffSession: true })).toBe(false);
    expect(shouldRecordMailTracking({ staffSession: false })).toBe(true);
  });

  it("does not record opens from the Agent Mail reading pane", () => {
    expect(shouldRecordMailTracking({ referer: "about:srcdoc" })).toBe(false);
    expect(shouldRecordMailTracking({ referer: "http://localhost:5000/agent-mail" })).toBe(false);
    expect(shouldRecordMailTracking({ referer: "https://leads.stratanexus.co.uk/agent-mail" })).toBe(false);
    expect(shouldRecordMailTracking({ referer: "" })).toBe(true);
  });
});

describe("opened outbound mail", () => {
  it("treats outbound mail with at least one open as opened, newest last", () => {
    expect(isOpenedOutboundMail({ direction: "outbound", opens: ["2026-09-01T10:00:00.000Z"] })).toBe(true);
    expect(isOpenedOutboundMail({ direction: "outbound", opens: [] })).toBe(false);
    expect(isOpenedOutboundMail({ direction: "inbound", opens: ["2026-09-01T10:00:00.000Z"] })).toBe(false);
    expect(
      lastMailOpenAt(["2026-09-01T10:00:00.000Z", "2026-09-01T15:34:44.501Z"]),
    ).toBe("2026-09-01T15:34:44.501Z");
  });
});
