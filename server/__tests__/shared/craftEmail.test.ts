import { describe, expect, it } from "vitest";
import {
  CRAFT_EMAIL_MARK,
  emailHtmlFromCraft,
  insertMergeTag,
  isCraftEmailDesign,
  wrapCraftEmailDesign,
} from "@/components/craft/lib/emailHtml";
import { documentFromTemplate } from "@/components/craft/lib/templates";
import { prepareCampaignSend } from "@shared/campaignSend";

describe("Craft email templates", () => {
  it("inserts a merge tag into copy without eating neighbouring words", () => {
    expect(insertMergeTag("Hi ,", "{{firstName}}", 3)).toBe("Hi {{firstName}},");
    expect(insertMergeTag("", "{{companyName}}")).toBe("{{companyName}}");
  });

  it("wraps a Craft board as an email design that round-trips", () => {
    const doc = documentFromTemplate("email-letter");
    const wrapped = wrapCraftEmailDesign(doc);
    expect(wrapped.engine).toBe(CRAFT_EMAIL_MARK);
    expect(isCraftEmailDesign(wrapped)).toBe(true);
    expect(isCraftEmailDesign({ body: { rows: [] } })).toBe(false);
    expect(isCraftEmailDesign("plaintext")).toBe(false);
  });

  it("exports table HTML that keeps merge tags for the send path", () => {
    const doc = documentFromTemplate("email-letter");
    const html = emailHtmlFromCraft(doc);
    expect(html).toMatch(/\{\{firstName\}\}/);
    expect(html).toMatch(/\{\{senderName\}\}/);
    expect(html).toMatch(/\{\{unsubscribeLink\}\}/);
    expect(html).toMatch(/<table/i);
    expect(html).not.toMatch(/&amp;lcub;&amp;lcub;/);

    const sent = prepareCampaignSend({
      subject: "Hi {{firstName}}",
      content: html,
      recipient: {
        id: 41,
        email: "accounts@acmejoinery.co.uk",
        firstName: "David",
        lastName: "Cole",
        companyName: "Acme Joinery Limited",
        verificationStatus: "valid",
        status: "pending",
      },
      baseUrl: "https://app.stratafinance.co.uk",
    });
    expect(sent.skipReason).toBeNull();
    if (sent.skipReason) return;
    expect(sent.html).toMatch(/Hi David/);
    expect(sent.html).toMatch(/James Hale/);
    expect(sent.html).not.toMatch(/\{\{firstName\}\}/);
  });
});
