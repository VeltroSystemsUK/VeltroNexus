import { describe, expect, it } from "vitest";
import {
  companyDomainFromWebsite,
  contactMailboxGuesses,
  emailsFromScrapedText,
  emailsOnCompanyDomain,
  inferMailboxPattern,
} from "@shared/companyMailbox";

describe("company domain mailbox engine", () => {
  it("takes the domain from the company website and drops registry hosts", () => {
    expect(companyDomainFromWebsite("https://www.btscars.co.uk/contact")).toBe("btscars.co.uk");
    expect(companyDomainFromWebsite("https://find-and-update.company-information.service.gov.uk/company/1")).toBe(
      null
    );
  });

  it("keeps only addresses on that domain", () => {
    expect(
      emailsOnCompanyDomain(
        ["sales@btscars.co.uk", "enquiries@companieshouse.gov.uk", "bob@mail.btscars.co.uk"],
        "btscars.co.uk"
      )
    ).toEqual(["sales@btscars.co.uk", "bob@mail.btscars.co.uk"]);
  });

  it("guesses first.last and first on the company domain for a real person", () => {
    expect(contactMailboxGuesses("petshop.co.uk", ["Adam Taylor"])).toEqual([
      "adam.taylor@petshop.co.uk",
      "ataylor@petshop.co.uk",
      "adam@petshop.co.uk",
    ]);
    expect(contactMailboxGuesses("o-i.com", ["O-I EUROPE SARL"])).toEqual([]);
  });

  it("learns the company's mailbox pattern from a real address on that domain", () => {
    expect(inferMailboxPattern(["jane.smith@petshop.co.uk", "info@petshop.co.uk"])).toBe("first.last");
    expect(inferMailboxPattern(["ataylor@petshop.co.uk"], ["Adam Taylor"])).toBe("flast");
    expect(inferMailboxPattern(["info@petshop.co.uk", "sales@petshop.co.uk"])).toBe(null);
    expect(contactMailboxGuesses("petshop.co.uk", ["Adam Taylor"], "first.last")).toEqual([
      "adam.taylor@petshop.co.uk",
    ]);
  });

  it("reads email@ from page text and does not swallow a preceding newline as nemail@", () => {
    expect(emailsFromScrapedText("Derby\n\nemail@heritagetrimmings.co.uk\nPhone: 01332")).toEqual([
      "email@heritagetrimmings.co.uk",
    ]);
  });

  it("drops nursery directories and listing sites as if they were not the company website", () => {
    expect(companyDomainFromWebsite("https://www.daynurseries.co.uk/daynursery.cfm/searchazref/50003020ALPD")).toBe(
      null
    );
    expect(companyDomainFromWebsite("https://www.yell.com/biz/acme")).toBe(null);
  });
});
