import { describe, expect, it } from "vitest";
import {
  emptyApplicationData,
  isApplicationDataComplete,
  missingRequiredDirectorFields,
  missingRequiredFields,
  applicationDataGapSummary,
} from "@shared/applicationDataFields";
import { missingInfoEmailCopy } from "@shared/missingInfoEmail";
import { ATTACHMENT_ITEMS } from "@shared/attachmentsChecklist";

describe("application data gating", () => {
  it("flags every required field missing on an empty application", () => {
    const missing = missingRequiredFields({});
    expect(missing.map((f) => f.id)).toContain("legalName");
    expect(missing.map((f) => f.id)).toContain("loanAmount");
  });

  it("requires at least one director", () => {
    expect(missingRequiredDirectorFields([]).noDirectors).toBe(true);
  });

  it("is not complete until required company/facility fields and one director's required fields are answered", () => {
    const partial = {
      answers: { legalName: "Acme Ltd" },
      directors: [{ id: "d1", fullName: "Jo Bloggs" }],
    };
    expect(isApplicationDataComplete(partial)).toBe(false);
  });

  it("resolves complete once every required field on a section and a director are answered", () => {
    const requiredCompanyFacility = missingRequiredFields({});
    const answers: Record<string, string> = {};
    for (const field of requiredCompanyFacility) answers[field.id] = "x";

    const requiredDirector = missingRequiredDirectorFields([{ id: "d1" }]).perDirector[0].missing;
    const director: Record<string, string> = { id: "d1" };
    for (const field of requiredDirector) director[field.id] = "x";

    expect(isApplicationDataComplete({ answers, directors: [director as any] })).toBe(true);
  });

  it("gap summary reads as plain labels, not field ids", () => {
    const gaps = applicationDataGapSummary(emptyApplicationData());
    expect(gaps).toContain("Legal business name");
    expect(gaps.some((g) => g.includes("_"))).toBe(false);
  });
});

describe("missing-info email copy", () => {
  it("returns null when nothing is missing", () => {
    const requiredCompanyFacility = missingRequiredFields({});
    const answers: Record<string, string> = {};
    for (const field of requiredCompanyFacility) answers[field.id] = "x";
    const requiredDirector = missingRequiredDirectorFields([{ id: "d1" }]).perDirector[0].missing;
    const director: Record<string, string> = { id: "d1" };
    for (const field of requiredDirector) director[field.id] = "x";

    const packDocuments = ATTACHMENT_ITEMS.map((item, i) => ({
      id: `doc-${i}`,
      category: item.id as any,
      fileName: `${item.id}.pdf`,
      fileSize: 1,
      fileType: "application/pdf",
      storagePath: `/tmp/${item.id}.pdf`,
      uploadedAt: new Date().toISOString(),
    }));

    const copy = missingInfoEmailCopy({
      companyName: "Acme Ltd",
      contactName: "Jo Bloggs",
      uploadToken: "tok123",
      packDocuments,
      applicationData: { status: "complete", answers, directors: [director as any] },
    });
    expect(copy).toBeNull();
  });

  it("names the gaps and links the GOAF when something is missing", () => {
    const copy = missingInfoEmailCopy({
      companyName: "Acme Ltd",
      contactName: "Jo Bloggs",
      uploadToken: "tok123",
      packDocuments: [],
      applicationData: emptyApplicationData(),
    });
    expect(copy).not.toBeNull();
    expect(copy!.missingDataLabels.length).toBeGreaterThan(0);
    expect(copy!.text).toContain("Jo");
    expect(copy!.html).toContain("tok123");
  });
});
