import { describe, expect, it } from "vitest";
import {
  countLiveNonBankCharges,
  isBankOrBuildingSocietyChargee,
  isLiveCharge,
  isP0,
} from "@shared/chargeClassifier";

describe("charge classifier", () => {
  it("treats clearing banks as deny-list", () => {
    expect(isBankOrBuildingSocietyChargee("HSBC BANK PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("National Westminster Bank Plc")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Lloyds Bank PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("BARCLAYS BANK PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Nationwide Building Society")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Santander UK PLC")).toBe(true);
  });

  it("treats MCA, HP, invoice finance as non-bank", () => {
    expect(isBankOrBuildingSocietyChargee("IWOCA LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("CLOSE BROTHERS LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("SIEMENS FINANCIAL SERVICES LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("BIBBY FACTORS LIMITED")).toBe(false);
  });

  it("ignores satisfied charges and bank-only books", () => {
    expect(isLiveCharge("satisfied")).toBe(false);
    expect(isLiveCharge("fully-satisfied")).toBe(false);
    expect(isLiveCharge("outstanding")).toBe(true);
    expect(
      countLiveNonBankCharges([
        { status: "outstanding", personsEntitled: ["HSBC BANK PLC"] },
        { status: "outstanding", personsEntitled: ["IWOCA LIMITED"] },
        { status: "satisfied", personsEntitled: ["YOULEND LIMITED"] },
      ])
    ).toBe(1);
  });

  it("is P0 on one live non-bank charge or a petition", () => {
    expect(isP0({ liveNonBankChargeCount: 1 })).toBe(true);
    expect(isP0({ liveNonBankChargeCount: 0, hasPetition: true })).toBe(true);
    expect(isP0({ liveNonBankChargeCount: 0 })).toBe(false);
    expect(isP0({ liveNonBankChargeCount: 0, hasPetition: false })).toBe(false);
  });
});
