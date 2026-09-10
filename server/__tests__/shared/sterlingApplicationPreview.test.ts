import { describe, expect, it } from "vitest";
import {
  answersFromSterlingFile,
  applicationFormHtml,
  directorsFromContacts,
  sectionsForLender,
} from "@shared/sterlingApplicationPreview";

describe("sterling application form preview", () => {
  it("only includes fields that lender actually asks", () => {
    const bcrs = sectionsForLender("bcrs").flatMap((s) => s.fields.map((f) => f.id));
    const cwrt = sectionsForLender("cwrt").flatMap((s) => s.fields.map((f) => f.id));
    expect(bcrs).toContain("accountantPracticeContact");
    expect(cwrt).not.toContain("accountantPracticeContact");
    expect(cwrt).toContain("bankDeclineConfirmed");
  });

  it("fills from the Nexus file and leaves blanks as not on file", () => {
    const answers = answersFromSterlingFile({
      companyName: "THE HOME CRAFTERS LTD.",
      companyNumber: "10034885",
      loanAmount: 120000,
      term: 60,
      loanPurpose: "Repay short term loans",
    });
    expect(answers.legalName).toBe("THE HOME CRAFTERS LTD.");
    expect(answers.loanAmount).toBe("£120,000");
    expect(answers.loanTerm).toBe("60 months");
    expect(answers.legalEntityType).toBe("Limited company");
    expect(answers.tradingAddress).toBeUndefined();

    const html = applicationFormHtml({
      lenderId: "ffe",
      companyName: "THE HOME CRAFTERS LTD.",
      answers,
      directors: directorsFromContacts([{ name: "Kirsty Bevan", role: "Director" }]),
    });
    expect(html).toContain("Finance For Enterprise application form");
    expect(html).toContain("THE HOME CRAFTERS LTD.");
    expect(html).toContain("£120,000");
    expect(html).toContain("Kirsty Bevan");
    expect(html).toContain("Preview only");
    expect(html).not.toContain("NOT ON FILE");
    expect(html).toContain("210mm");
    expect(html).not.toContain("complete it");
  });
});
