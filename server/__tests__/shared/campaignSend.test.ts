import { describe, expect, it } from "vitest";
import { wasEmailDelivered } from "@shared/outreachSend";
import {
  CAMPAIGN_AGENT_ID,
  campaignMailbox,
  campaignUnsubscribeUrl,
  prepareCampaignSend,
} from "@shared/campaignSend";

const corporate = {
  id: 41,
  email: "accounts@acmejoinery.co.uk",
  firstName: "David",
  lastName: "Cole",
  companyName: "Acme Joinery Limited",
  verificationStatus: "valid" as const,
  status: "pending" as const,
};

describe("campaign outbound vessel", () => {
  it("sends as James Hale from the shared enquiries mailbox", () => {
    const box = campaignMailbox();
    expect(CAMPAIGN_AGENT_ID).toBe("outreach-sales");
    expect(box.address).toBe("enquiries@stratafinance.co.uk");
    expect(box.fromName).toMatch(/James Hale/);
    expect(box.replyTo).toBe("enquiries@stratafinance.co.uk");
  });
});

describe("campaign recipient skip", () => {
  it("skips a personal mailbox under PECR", () => {
    const result = prepareCampaignSend({
      subject: "Hello",
      content: "<p>Hi</p>",
      recipient: { ...corporate, email: "dave@gmail.com" },
      baseUrl: "https://app.stratafinance.co.uk",
    });
    expect(result.skipReason).toMatch(/personal/i);
  });

  it("skips a recipient marked invalid", () => {
    const result = prepareCampaignSend({
      subject: "Hello",
      content: "<p>Hi</p>",
      recipient: { ...corporate, verificationStatus: "invalid" },
      baseUrl: "https://app.stratafinance.co.uk",
    });
    expect(result.skipReason).toMatch(/invalid/i);
  });

  it("prepares a corporate recipient through the outreach mailbox", () => {
    const result = prepareCampaignSend({
      subject: "Hi {{firstName}} from {{senderCompany}}",
      content:
        "<p>Hello {{firstName}} at {{companyName}}, {{senderName}} here. {{unsubscribeLink}}</p></body>",
      recipient: corporate,
      baseUrl: "https://app.stratafinance.co.uk",
    });
    expect(result.skipReason).toBeNull();
    if (result.skipReason) return;
    expect(result.to).toBe("accounts@acmejoinery.co.uk");
    expect(result.subject).toBe("Hi David from Strata Finance");
    expect(result.html).toMatch(/James Hale/);
    expect(result.html).toMatch(/Acme Joinery Limited/);
    expect(result.html).toMatch(/email-tracking\/unsubscribe\/41/);
    expect(result.html).toMatch(/email-tracking\/open\/41/);
    expect(result.html).not.toMatch(/Veltro/);
    expect(result.credentials.agentId).toBe("outreach-sales");
    expect(result.credentials.fromEmail).toBe("enquiries@stratafinance.co.uk");
    expect(result.credentials.fromName).toMatch(/James Hale/);
    expect(result.credentials.replyTo).toBe("enquiries@stratafinance.co.uk");
  });
});

describe("campaign delivery", () => {
  it("does not treat a mock SMTP send as delivered", () => {
    expect(wasEmailDelivered({ success: true, mock: true })).toBe(false);
  });

  it("builds an unsubscribe URL on the tracking path", () => {
    expect(campaignUnsubscribeUrl("https://app.stratafinance.co.uk/", 9)).toBe(
      "https://app.stratafinance.co.uk/api/email-tracking/unsubscribe/9"
    );
  });
});
