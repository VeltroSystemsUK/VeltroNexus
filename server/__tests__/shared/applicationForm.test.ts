import { describe, expect, it } from "vitest";
import {
  applyApplicationSignature,
  isApplicationDataComplete,
  isApplicationSigned,
  missingRequiredDirectorFields,
  missingRequiredFields,
  parseApplicationData,
  seedAnswersFromFile,
  seedDirectorFromContact,
} from "@shared/applicationDataFields";
import { buildApplicationFormDocx } from "@shared/applicationFormDoc";

describe("application seed from the Nexus file", () => {
  it("maps company, postcode from address, Ltd, and loan amount without inventing identity", () => {
    const answers = seedAnswersFromFile({
      companyName: "THE HOME CRAFTERS LTD.",
      companyNumber: "10034885",
      registeredAddress: "17 West Walk, Bristol, England, BS37 4AX",
      legalEntityType: "ltd",
      loanAmount: 120000,
      term: 60,
      loanPurpose: "Repay short term loans",
    });
    expect(answers.legalName).toBe("THE HOME CRAFTERS LTD.");
    expect(answers.postcode).toMatch(/BS37\s*4AX/);
    expect(answers.legalEntityType).toBe("Limited company");
    expect(answers.loanAmount).toBe("£120,000");
    expect(answers.dateOfBirth).toBeUndefined();
    expect(answers.niNumber).toBeUndefined();
  });

  it("lets saved answers win over the seed", () => {
    const answers = seedAnswersFromFile(
      { companyName: "Old Ltd", companyNumber: "1" },
      { legalName: "New Ltd", natureOfBusiness: "Craft retail" },
    );
    expect(answers.legalName).toBe("New Ltd");
    expect(answers.natureOfBusiness).toBe("Craft retail");
  });

  it("seeds a director from a contact without inventing NI or DOB", () => {
    const director = seedDirectorFromContact({
      id: 9,
      name: "Kirsty Bevan",
      email: "homecraftersuk@gmail.com",
      phone: "07792486704",
      role: "Director",
    });
    expect(director.fullName).toBe("Kirsty Bevan");
    expect(director.personalEmail).toBe("homecraftersuk@gmail.com");
    expect(director.niNumber).toBeUndefined();
    expect(director.dateOfBirth).toBeUndefined();
  });
});

describe("application signature", () => {
  it("refuses to sign until required fields are complete", () => {
    expect(() =>
      applyApplicationSignature(parseApplicationData({ answers: { legalName: "Acme" }, directors: [] }), { name: "Jo" }, { at: "2026-09-09T00:00:00Z" }),
    ).toThrow(/required fields/i);
  });

  it("records the signed name and time when complete", () => {
    const answers: Record<string, string> = {};
    for (const field of missingRequiredFields({})) answers[field.id] = "x";
    const director: Record<string, string> = { id: "d1" };
    const gaps = missingRequiredDirectorFields([{ id: "d1" }]).perDirector[0].missing;
    for (const field of gaps) director[field.id] = "x";
    const signed = applyApplicationSignature(
      parseApplicationData({ answers, directors: [director] }),
      { name: "Kirsty Bevan", title: "Director" },
      { at: "2026-09-09T12:00:00Z", ip: "127.0.0.1" },
    );
    expect(isApplicationDataComplete(signed)).toBe(true);
    expect(isApplicationSigned(signed)).toBe(true);
    expect(signed.signedName).toBe("Kirsty Bevan");
    expect(signed.status).toBe("signed");
  });
});

describe("application Word form", () => {
  it("builds a BCRS Word doc with the company name and leaves blanks empty", async () => {
    const buf = await buildApplicationFormDocx("bcrs", {
      companyName: "THE HOME CRAFTERS LTD.",
      answers: { legalName: "THE HOME CRAFTERS LTD.", loanAmount: "£120,000" },
      directors: [{ id: "d1", fullName: "Kirsty Bevan" }],
    });
    expect(buf.length).toBeGreaterThan(2000);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("THE HOME CRAFTERS LTD.");
    expect(xml).toContain("BCRS");
    expect(xml).toContain("Kirsty Bevan");
    expect(xml).toContain("£120,000");
    expect(xml).not.toContain("NOT ON FILE");
  });
});
