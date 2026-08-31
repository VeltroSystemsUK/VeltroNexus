import { describe, expect, it } from "vitest";
import { isNavLocked } from "@shared/navLocks";

describe("isNavLocked", () => {
  it("greys marketing, workforce, and accounts for sales_admin", () => {
    expect(isNavLocked("sales_admin", "/workforce")).toBe(true);
    expect(isNavLocked("sales_admin", "/email-campaigns")).toBe(true);
    expect(isNavLocked("sales_admin", "/invoicing")).toBe(true);
    expect(isNavLocked("sales_admin", "/ai-studio")).toBe(true);
    expect(isNavLocked("sales_admin", "/craft")).toBe(true);
    expect(isNavLocked("sales_admin", "/editorial")).toBe(true);
  });

  it("leaves the Sterling workspace open", () => {
    expect(isNavLocked("sales_admin", "/pipeline")).toBe(false);
    expect(isNavLocked("sales_admin", "/broker-portal")).toBe(false);
    expect(isNavLocked("sales_admin", "/underwriting")).toBe(false);
    expect(isNavLocked("sales_admin", "/lenders")).toBe(false);
    expect(isNavLocked("sales_admin", "/credit-tools")).toBe(false);
    expect(isNavLocked("sales_admin", "/settings")).toBe(false);
  });

  it("does not lock Shaun as super_admin", () => {
    expect(isNavLocked("super_admin", "/workforce")).toBe(false);
    expect(isNavLocked("broker", "/email-campaigns")).toBe(false);
  });
});
