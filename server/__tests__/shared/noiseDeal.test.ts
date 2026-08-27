import { describe, expect, it } from "vitest";
import { isNoiseDeal } from "@shared/agenticWorkflow";

describe("isNoiseDeal", () => {
  it("drops pack-upload and scratch test files", () => {
    expect(isNoiseDeal({ companyName: "Pack Upload Test Ltd", ownerUserId: "pack-upload-test" })).toBe(true);
    expect(isNoiseDeal({ companyName: "Scratch seed co", ownerUserId: "shaun" })).toBe(true);
  });

  it("keeps real hunt and inbound files", () => {
    expect(isNoiseDeal({ companyName: "Acme Joinery Limited", ownerUserId: "user-1" })).toBe(false);
  });
});
