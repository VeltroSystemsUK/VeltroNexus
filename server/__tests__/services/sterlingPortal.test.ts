import { describe, expect, it } from "vitest";
import {
  attachmentCategoryFromFilename,
  attachmentsFromDocuments,
  attachmentsFromFilenames,
  defaultSterlingSettings,
  isSterlingLenderId,
  isSterlingOversightRole,
  isSterlingPortalRole,
  parseSterlingSettings,
  sterlingPackLines,
} from "@shared/sterlingPortal";

describe("sterling portal helpers", () => {
  it("lets David and admins into the portal, and only admins see every file", () => {
    expect(isSterlingPortalRole("external_broker")).toBe(true);
    expect(isSterlingPortalRole("super_admin")).toBe(true);
    expect(isSterlingPortalRole("sales_admin")).toBe(true);
    expect(isSterlingPortalRole("broker")).toBe(false);
    expect(isSterlingOversightRole("super_admin")).toBe(true);
    expect(isSterlingOversightRole("external_broker")).toBe(false);
  });

  it("recognises the four send lenders and rejects others", () => {
    expect(isSterlingLenderId("ffe")).toBe(true);
    expect(isSterlingLenderId("firstent")).toBe(true);
    expect(isSterlingLenderId("swig")).toBe(false);
  });

  it("fills destination settings without dropping unknown keys silently", () => {
    const parsed = parseSterlingSettings({
      ffe: { email: "a@ffe.org.uk", apiUrl: "https://ffe.example/api", apiKey: "k" },
      extra: { email: "nope" },
    });
    expect(parsed.ffe.email).toBe("a@ffe.org.uk");
    expect(parsed.cwrt.email).toBe("");
    expect(parsed).toEqual({ ...defaultSterlingSettings(), ffe: parsed.ffe });
  });

  it("ticks checklist items from uploaded filenames and lists the uniform pack lines", () => {
    const items = attachmentsFromFilenames(
      ["2024-accounts.pdf", "June-bank-statements.pdf"],
      [{ id: "id", attached: true }]
    );
    expect(items.find((i) => i.id === "accounts")?.attached).toBe(true);
    expect(items.find((i) => i.id === "bank-statements")?.attached).toBe(true);
    expect(items.find((i) => i.id === "id")?.attached).toBe(true);
    expect(items.find((i) => i.id === "insurance")?.attached).toBe(false);

    const lines = sterlingPackLines(items);
    expect(lines[0]).toEqual({ label: "Completed Loan Application", ok: true });
    expect(lines[1]).toEqual({ label: "Funding proposal stamped", ok: true });
    expect(lines[2].label).toMatch(/supporting files$/);
    expect(lines.some((l) => l.label.toLowerCase().includes("insurance") && !l.ok)).toBe(true);
  });

  it("maps a due-diligence filename onto the handover item without a second upload", () => {
    expect(attachmentCategoryFromFilename("FY24-accounts.pdf")).toBe("accounts");
    expect(attachmentCategoryFromFilename("June-bank-statements.pdf")).toBe("bank-statements");
    expect(attachmentCategoryFromFilename("random-scan.pdf")).toBe("general");
  });

  it("treats a ticked box with no file as missing, and lists the actual uploaded files", () => {
    const items = attachmentsFromDocuments([
      { id: 11, fileName: "FY24-accounts.pdf", category: "accounts" },
      { id: 12, fileName: "random-scan.pdf", category: "general" },
    ]);
    const accounts = items.find((i) => i.id === "accounts");
    expect(accounts?.attached).toBe(true);
    expect(accounts?.files).toEqual([{ id: 11, fileName: "FY24-accounts.pdf" }]);
    expect(items.find((i) => i.id === "id")?.attached).toBe(false);
    expect(items.find((i) => i.id === "insurance")?.attached).toBe(false);
  });
});
