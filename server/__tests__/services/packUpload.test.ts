import { describe, expect, it } from "vitest";
import { isAllowedPackFile, isPackCategory } from "../../services/packUpload";
import { applyOnlineUrl, packUploadUrl, signEngagementUrl } from "@shared/strataOutreach";

describe("customer pack upload", () => {
  it("accepts the usual broker file types and rejects executables", () => {
    expect(isAllowedPackFile("June-statement.pdf", "application/pdf")).toBe(true);
    expect(isAllowedPackFile("accounts-2024.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isAllowedPackFile("photo.HEIC", "image/heic")).toBe(true);
    expect(isAllowedPackFile("payload.exe", "application/octet-stream")).toBe(false);
  });

  it("accepts Sterling pack categories and rejects unknown types", () => {
    expect(isPackCategory("bank_statements")).toBe(true);
    expect(isPackCategory("bank-statements")).toBe(true);
    expect(isPackCategory("cashflow")).toBe(true);
    expect(isPackCategory("id")).toBe(true);
    expect(isPackCategory("audited_accounts")).toBe(true);
    expect(isPackCategory("passport")).toBe(false);
  });

  it("builds a public pack URL from the deal token", () => {
    expect(packUploadUrl("abc_123")).toMatch(/\/pack\/abc_123$/);
    expect(packUploadUrl("")).toBeUndefined();
  });

  it("builds a public e-sign URL from the same deal token", () => {
    expect(signEngagementUrl("abc_123")).toMatch(/\/sign\/abc_123$/);
    expect(signEngagementUrl("")).toBeUndefined();
  });

  it("builds a public application URL from the token", () => {
    expect(applyOnlineUrl("abc_123")).toMatch(/\/apply\/abc_123$/);
    expect(applyOnlineUrl("")).toBeUndefined();
  });
});
