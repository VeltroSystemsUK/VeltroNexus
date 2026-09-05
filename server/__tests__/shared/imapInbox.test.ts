import { describe, expect, it } from "vitest";
import { imapConfigFromEnv, inboundAlreadyLogged, parseAddressList, pickMailboxPath } from "@shared/imapInbox";

describe("imapConfigFromEnv", () => {
  it("uses the SMTP mailbox login against IONOS IMAP", () => {
    const cfg = imapConfigFromEnv({
      SMTP_HOST: "smtp.ionos.co.uk",
      SMTP_USER: "enquiries@stratafinance.co.uk",
      SMTP_PASS: "secret",
    });
    expect(cfg).toEqual({
      host: "imap.ionos.co.uk",
      port: 993,
      secure: true,
      user: "enquiries@stratafinance.co.uk",
      pass: "secret",
    });
  });

  it("is missing when there is no mailbox password", () => {
    expect(imapConfigFromEnv({ SMTP_HOST: "smtp.ionos.co.uk", SMTP_USER: "enquiries@stratafinance.co.uk" })).toBeNull();
  });
});

describe("inboundAlreadyLogged", () => {
  it("skips a message-id already in the mail log", () => {
    expect(
      inboundAlreadyLogged(
        [{ messageId: "<abc@mail>", direction: "inbound" }],
        "<abc@mail>"
      )
    ).toBe(true);
    expect(inboundAlreadyLogged([{ messageId: "<abc@mail>", direction: "inbound" }], "<other@mail>")).toBe(false);
    expect(inboundAlreadyLogged([], "<abc@mail>")).toBe(false);
  });
});

describe("pickMailboxPath", () => {
  it("prefers SPECIAL-USE then common Sent names", () => {
    expect(
      pickMailboxPath(
        [
          { path: "INBOX", specialUse: "\\Inbox" },
          { path: "Sent Items", name: "Sent Items", specialUse: "\\Sent" },
        ],
        "\\Sent",
        ["Sent", "Sent Items", "INBOX.Sent"],
      ),
    ).toBe("Sent Items");
    expect(
      pickMailboxPath(
        [{ path: "INBOX.Sent", name: "Sent" }],
        "\\Sent",
        ["Sent", "Sent Items", "INBOX.Sent"],
      ),
    ).toBe("INBOX.Sent");
  });
});

describe("parseAddressList", () => {
  it("takes the email from a display-name address", () => {
    expect(parseAddressList("Shaun Tuhey <shaun@veltro.co.uk>")).toBe("shaun@veltro.co.uk");
    expect(parseAddressList('"James Hale · Business Consultant" <enquiries@stratafinance.co.uk>')).toBe(
      "enquiries@stratafinance.co.uk"
    );
  });
});
