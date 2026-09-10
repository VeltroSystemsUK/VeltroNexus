import { describe, expect, it } from "vitest";
import { compileIntroducerStep, INTRODUCER_PANEL_ONE_LINER } from "@shared/introducerPlaybook";

const fields = {
  introducerFirm: "Hartley Accountants Ltd",
  introducerFirstNameOrRole: "the directors",
  panelOneLiner: INTRODUCER_PANEL_ONE_LINER,
  senderName: "James Hale",
  senderFirm: "Strata Finance",
  senderPhone: "",
  sourceExplanation: "the contact page at hartleyaccountants.co.uk/contact",
};

describe("compileIntroducerStep", () => {
  it("compiles b0 with STOP and source explanation, no SME leak", () => {
    const result = compileIntroducerStep("intro_1", fields);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subject).toMatch(/Hartley Accountants Ltd/);
    expect(result.text).toMatch(/reply stop/i);
    expect(result.text).toMatch(/hartleyaccountants\.co\.uk\/contact/);
    expect(result.text).toMatch(/You keep the client/i);
    expect(result.text).not.toMatch(/Acme|Mill Lane|petition|opening_line|hypothesis/i);
    expect(result.text).not.toMatch(/bridging take-out/i);
  });

  it("holds b0 when panel_one_liner is missing", () => {
    const result = compileIntroducerStep("intro_1", { ...fields, panelOneLiner: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("playbook_gap");
  });

  it("stages LinkedIn without a stop line and without sending", () => {
    const result = compileIntroducerStep("intro_linkedin", fields);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.channel).toBe("linkedin_staged");
    expect(result.text).not.toMatch(/reply stop/i);
    expect(result.text).not.toMatch(/Acme|petition/i);
  });

  it("closes on intro_2 without a phone clause when phone is empty", () => {
    const result = compileIntroducerStep("intro_2", fields);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toMatch(/reply stop/i);
    expect(result.text).not.toMatch(/or call/);
    expect(result.final).toBe(true);
  });
});
