import { describe, expect, it } from "vitest";
import { chargeLetterHtml, letterForLead } from "@shared/chargeLetter";

describe("letterForLead", () => {
  it("writes a named, specific letter and skips Together-only property charges", () => {
    const letter = letterForLead(
      {
        companyName: "Pet Shop Ltd",
        contactName: "TAYLOR, Adam",
        address: "12 High Street",
        city: "Derby",
        identifiedLender: "Iwoca Limited",
        hasCharges: true,
      },
      new Date("2026-09-21T12:00:00Z"),
    );
    expect(letter).not.toBeNull();
    expect(letter!.greeting).toBe("Dear Adam,");
    expect(letter!.body.join(" ")).toMatch(/Iwoca/);
    expect(letter!.body.join(" ")).toMatch(/Pet Shop Ltd/);
    expect(letter!.body.join(" ")).not.toMatch(/unlock|synergy|reach out|don't hesitate/i);
    expect(letter!.signOff).toBe("Shaun");

    expect(
      letterForLead({
        companyName: "Acme Joinery Ltd",
        contactName: "Jane Smith",
        identifiedLender: "Together Commercial Limited",
        hasCharges: true,
      }),
    ).toBeNull();
  });
});

describe("chargeLetterHtml", () => {
  it("lays out a print page without marketing chrome", () => {
    const html = chargeLetterHtml([
      {
        companyName: "Pet Shop Ltd",
        contactName: "Adam Taylor",
        address: "12 High Street",
        city: "Derby",
        identifiedLender: "Iwoca Ltd",
        hasCharges: true,
      },
    ]);
    expect(html).toMatch(/Dear Adam,/);
    expect(html).toMatch(/@page/);
    expect(html).not.toMatch(/CONFIDENTIAL|UNLOCK/i);
  });
});
