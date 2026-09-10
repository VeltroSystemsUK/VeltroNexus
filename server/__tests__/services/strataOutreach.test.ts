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

  it("sme_open thanks them and points at the Learn training hub", () => {
    const email = renderOutreachEmail(huntDeal, "sme_open", "outreach-sales");
    expect(email.touchId).toBe("sme_open");
    expect(email.text).toMatch(/Thanks for taking an interest/i);
    expect(email.text).toContain("https://learn.stratanexus.co.uk");
    expect(email.text).toContain("https://explore.stratanexus.co.uk");
    expect(email.html).toMatch(/href="https:\/\/learn\.stratanexus\.co\.uk"/);
    expect(email.text).toMatch(/training path/i);
    expect(email.text).toMatch(/four-question assessment/i);
    expect(email.html).toMatch(/Start the training/);
    expect(email.text).toMatch(/reply stop/i);
    expect(email.text).toMatch(/James Hale/);
    expect(email.text).not.toMatch(/I saw you opened/i);
    expect(email.html).not.toMatch(/Upload your documents/);
  });

  it("sme_followup points at Learn and does not re-pitch Explore", () => {
    const email = renderOutreachEmail(huntDeal, "sme_followup", "outreach-sales");
    expect(email.touchId).toBe("sme_followup");
    expect(email.text).toMatch(/high-cost debt and HMRC commitments/i);
    expect(email.text).toMatch(/videos, press coverage, and my notes/i);
    expect(email.text).toContain("https://learn.stratanexus.co.uk");
    expect(email.html).toMatch(/href="https:\/\/learn\.stratanexus\.co\.uk"/);
    expect(email.html).toMatch(/Open Strata Learn/);
    expect(email.html).toMatch(/target="_blank"/);
    expect(email.text).not.toMatch(/explore\.stratanexus\.co\.uk/);
    expect(email.html).not.toMatch(/explore\.stratanexus\.co\.uk/);
    expect(email.text).toMatch(/reply stop/i);
    expect(email.text).toMatch(/James Hale/);
    expect(email.html).not.toMatch(/Upload your documents/);
  });

  it("renders the Stream B partner email", () => {
    const email = renderOutreachEmail(
      { ...huntDeal, stream: "introducer" },
      "intro_1",
      "outreach-sales"
    );
    expect(email.subject).toMatch(/CDFI packaging/i);
    expect(email.text).toMatch(/accountancy practices/i);
    expect(email.text).toMatch(/reply stop/i);
    expect(email.text).toMatch(/You keep the client/i);
    expect(email.text).not.toMatch(/Acme|petition|Mill Lane/i);
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

describe("convert templates", () => {
  const deal = { ...huntDeal, contactName: "David Cole" };
  const unnamed = { ...huntDeal, contactName: "" };

  it("N1–N3 point at www.stratafinance.co.uk, stop line, packager identity, no Learn/call ask", () => {
    for (const id of ["sme_n1", "sme_n2", "sme_n2_hmrc", "sme_n2_clicked", "sme_n3", "sme_n3_form"] as const) {
      const email = renderOutreachEmail(deal, id, "outreach-sales");
      expect(email.subject.length).toBeLessThanOrEqual(45);
      expect(email.text).toContain("https://www.stratafinance.co.uk/");
      expect(email.text).toContain("If this isn't useful, reply stop and we won't email again.");
      expect(email.text).toMatch(/do not lend/i);
      expect(email.text).not.toMatch(/learn\.stratanexus|explore\.stratanexus/i);
      expect(email.text).not.toMatch(/10-minute|Thursday|brief call/i);
      expect(email.html).toContain("sf=");
    }
    expect(renderOutreachEmail(deal, "sme_n1", "outreach-sales").subject).toBe("30 seconds on eligibility");
    expect(renderOutreachEmail(deal, "sme_n3", "outreach-sales").text).toContain("?sf=n3#contact");
    expect(renderOutreachEmail(unnamed, "sme_n1", "outreach-sales").text).toMatch(/^Hi,/);
    expect(renderOutreachEmail(unnamed, "sme_n1", "outreach-sales").text).not.toMatch(/Hi there,/);
  });
});
