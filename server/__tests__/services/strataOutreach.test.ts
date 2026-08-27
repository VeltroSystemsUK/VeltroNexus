import { describe, it, expect } from "vitest";
import {
  firstName,
  lenderLabel,
  nextColdTouch,
  renderOutreachEmail,
  renderSmeCall,
  renderWarmCall,
} from "@shared/strataOutreach";

const huntDeal = {
  companyName: "Acme Joinery Limited",
  contactName: "David Cole",
  source: "distress_scan" as const,
  fitSummary: "Strata fit 82/100 — merchant cash advance",
  fitReasons: ["merchant cash advance / daily-repay facility (Iwoca)"],
};

describe("strata outreach scripts", () => {
  it("uses the first name and the public lender", () => {
    expect(firstName("David Cole")).toBe("David");
    expect(lenderLabel(huntDeal)).toBe("Iwoca");
  });

  it("Stream A day 1 uses the debt-service playbook and does not ask for a pack", () => {
    const email = renderOutreachEmail(huntDeal, "sme_1", "outreach-sales");
    expect(email.subject).toMatch(/Restructuring Acme Joinery Limited/i);
    expect(email.text).toMatch(/CDFI/);
    expect(email.text).toMatch(/10-minute confidential review/i);
    expect(email.text).not.toMatch(/bank statements/i);
    expect(email.text).toMatch(/reply stop/i);
    expect(email.text).toMatch(/James Hale/);
    expect(email.text).not.toMatch(/\bShaun\b/);
    expect(email.html).toMatch(/enquiries@stratafinance\.co\.uk/);
    expect(email.html).toMatch(/strata-logo-light\.png/);
    expect(email.html).toMatch(/Strata Finance/);
    expect(email.html).toMatch(/not authorised or regulated by the FCA/i);
    expect(email.html).toMatch(/0115 984 9800/);
    expect(email.html).toMatch(/Sterling House/);
    expect(email.text).toMatch(/NG12 4DG/);
  });

  it("Stream A day 1 on an HMRC petition leads with the hearing, not generic debt service", () => {
    const email = renderOutreachEmail(
      {
        ...huntDeal,
        petition: {
          kind: "hmrc_winding_up",
          publishedAt: "2026-08-20T09:00:00.000Z",
          hearingAt: "2026-09-02T00:00:00.000Z",
        },
      },
      "sme_1",
      "outreach-sales"
    );
    expect(email.subject).toMatch(/HMRC petition/i);
    expect(email.text).toMatch(/winding-up petition/i);
    expect(email.text).toMatch(/2 September 2026|September 2, 2026/i);
    expect(email.text).toMatch(/before the petition is heard/i);
    expect(email.text).not.toMatch(/bank statements/i);
    expect(email.text).toMatch(/reply stop/i);
  });

  it("maps legacy cold_1 onto the Stream A day 1 template", () => {
    const email = renderOutreachEmail(huntDeal, "cold_1", "outreach-sales");
    expect(email.touchId).toBe("sme_1");
    expect(email.text).toMatch(/CDFI/);
  });

  it("inbound ack asks for the required Sterling pack", () => {
    const email = renderOutreachEmail(
      { ...huntDeal, uploadToken: "pack-token-test" },
      "inbound_ack",
      "inbound-intake"
    );
    expect(email.text).toMatch(/bank statements/i);
    expect(email.text).toMatch(/cash flow/i);
    expect(email.text).toMatch(/debt schedule|existing facilities/i);
    expect(email.text).toMatch(/photo ID|director/i);
    expect(email.text).toMatch(/\/pack\/pack-token-test/);
    expect(email.html).toMatch(/Upload your documents/);
    expect(email.html).toMatch(/\/pack\/pack-token-test/);
  });

  it("cold email does not include a customer upload link", () => {
    const email = renderOutreachEmail(
      { ...huntDeal, uploadToken: "pack-token-test" },
      "sme_1",
      "outreach-sales"
    );
    expect(email.html).not.toMatch(/Upload your documents/);
    expect(email.text).not.toMatch(/\/pack\//);
  });

  it("sequences Stream A 1 → LinkedIn → case study → close", () => {
    expect(nextColdTouch(undefined)).toBe("sme_1");
    expect(nextColdTouch(1)).toBe("sme_linkedin");
    expect(nextColdTouch(2)).toBe("sme_2");
    expect(nextColdTouch(3)).toBe("sme_close");
  });

  it("renders the Stream B partner email", () => {
    const email = renderOutreachEmail(
      { ...huntDeal, stream: "introducer" },
      "intro_1",
      "outreach-sales"
    );
    expect(email.subject).toMatch(/corporate clients/i);
    expect(email.text).toMatch(/accountancy practices/i);
    expect(email.text).toMatch(/reply stop/i);
  });

  it("warm call is permission-based and names Strata", () => {
    const call = renderWarmCall({ ...huntDeal, phone: "07700 900123", email: "dave@acme.test" }, "0121 000 0000");
    expect(call.opener).toMatch(/Strata Finance/);
    expect(call.opener).toMatch(/two minutes/i);
    expect(call.beats.length).toBeGreaterThanOrEqual(4);
    expect(call.voicemail).toContain("0121 000 0000");
    expect(call.objections.some((item) => /not interested/i.test(item.hear))).toBe(true);
  });

  it("SME close call asks for the debt schedule", () => {
    const call = renderSmeCall(huntDeal);
    expect(call.opener).toMatch(/Strata Finance/);
    expect(call.opener).toMatch(/CDFI/);
    expect(call.beats.some((beat) => /debt schedule/i.test(beat.say))).toBe(true);
  });
});
