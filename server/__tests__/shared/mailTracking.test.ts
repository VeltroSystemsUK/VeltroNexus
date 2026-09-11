import { describe, expect, it } from "vitest";
import { injectMailTracking } from "../../services/agentMailLog";
import { ensureMailLinksOpenInNewTab, isOpenedOutboundMail, lastMailOpenAt, mailDwellScript, outboundTrackingState, shouldRecordMailTracking, shouldTrackMailHref, stripMailTracking, withMailDwellToken } from "@shared/mailTracking";

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

  it("leaves the signature homepage as a direct href and still wraps product CTAs", () => {
    const html = injectMailTracking(
      `<a href="https://stratafinance.co.uk"><img alt="logo"></a><a href="https://stratafinance.co.uk">stratafinance.co.uk</a><a href="https://stratafinance.co.uk/strata-solution.html">structure</a><a href="https://www.stratafinance.co.uk/?sf=n1#tools">tools</a>`,
      "MAIL-9",
    );
    expect(html).toContain('href="https://stratafinance.co.uk"><img');
    expect(html).toContain('href="https://stratafinance.co.uk">stratafinance.co.uk');
    expect(html).not.toMatch(/click\/MAIL-9\?url=https%3A%2F%2Fstratafinance\.co\.uk"/);
    expect(html).toMatch(/\/api\/agent-mail\/click\/MAIL-9\?url=.*strata-solution\.html/);
    expect(html).toMatch(/\/api\/agent-mail\/click\/MAIL-9\?url=.*sf%3Dn1/);
  });
});

describe("shouldTrackMailHref", () => {
  it("does not track the bare Strata homepage used in the signature", () => {
    expect(shouldTrackMailHref("https://stratafinance.co.uk")).toBe(false);
    expect(shouldTrackMailHref("https://www.stratafinance.co.uk/")).toBe(false);
    expect(shouldTrackMailHref("https://stratafinance.co.uk/strata-solution.html")).toBe(true);
    expect(shouldTrackMailHref("https://www.stratafinance.co.uk/?sf=n1#tools")).toBe(true);
  });
});

describe("withMailDwellToken", () => {
  it("stamps a dwell token onto Strata URLs and leaves others alone", () => {
    expect(withMailDwellToken("https://www.stratafinance.co.uk/?sf=n1#tools", "abc-1")).toBe(
      "https://www.stratafinance.co.uk/?sf=n1&d=abc-1#tools"
    );
    expect(withMailDwellToken("https://example.com/pack", "abc-1")).toBe("https://example.com/pack");
  });
});

describe("mailDwellScript", () => {
  it("waits 10s then hits the Nexus dwell pixel with sf and path", () => {
    const script = mailDwellScript("https://leads.stratanexus.co.uk");
    expect(script).toContain("10000");
    expect(script).toContain("https://leads.stratanexus.co.uk/api/agent-mail/dwell/");
    expect(script).toContain("q.get(\"sf\")");
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

describe("outbound tracking state", () => {
  it("does not call a failed or mock log line sent", () => {
    expect(
      outboundTrackingState({
        direction: "outbound",
        status: "failed",
        html: "<p>Hi</p>",
      })?.label
    ).toBe("Not sent");
    expect(
      outboundTrackingState({
        direction: "outbound",
        status: "mock",
        html: "<p>Hi</p>",
      })?.detail
    ).not.toMatch(/Sent before/);
  });
});
