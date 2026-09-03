import { describe, expect, it } from "vitest";
import { injectMailTracking } from "../../services/agentMailLog";
import { ensureMailLinksOpenInNewTab, isOpenedOutboundMail, lastMailOpenAt, shouldRecordMailTracking, stripMailTracking } from "@shared/mailTracking";

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

  it("leaves the diagnostic quiz URL as a direct href", () => {
    const html = injectMailTracking(
      `<p><a href="https://explore.stratanexus.co.uk" target="_blank">Take the four-question assessment</a></p>`,
      "TEST-ID-123",
    );
    expect(html).toContain('href="https://explore.stratanexus.co.uk"');
    expect(html).not.toMatch(/\/api\/agent-mail\/click\/TEST-ID-123\?url=.*explore/);
  });
});

describe("ensureMailLinksOpenInNewTab", () => {
  it("adds target=_blank so preview clicks leave the sandboxed iframe", () => {
    const html = ensureMailLinksOpenInNewTab(
      `<p><a href="https://explore.stratanexus.co.uk" style="color:#2E5096">https://explore.stratanexus.co.uk</a></p>`,
    );
    expect(html).toContain('href="https://explore.stratanexus.co.uk"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not double-up an existing target", () => {
    const html = ensureMailLinksOpenInNewTab(
      `<a href="https://explore.stratanexus.co.uk" target="_blank" rel="noopener noreferrer">quiz</a>`,
    );
    expect(html.match(/target="_blank"/g)?.length).toBe(1);
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
