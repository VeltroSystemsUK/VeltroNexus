import { describe, expect, it } from "vitest";
import {
  chargeHoldersFromNames,
  dealChargeHolders,
  liveChargeHolders,
  registeredChargeHoldersFromNames,
} from "@shared/chargeClassifier";
import { isContactableDeal } from "@shared/smeHopper";

describe("live charge holders", () => {
  it("lists live non-bank persons entitled and drops high-street banks", () => {
    expect(
      liveChargeHolders([
        { status: "outstanding", personsEntitled: ["IWOCA LIMITED", "HSBC BANK PLC"] },
        { status: "satisfied", personsEntitled: ["YOULEND LIMITED"] },
        { status: "outstanding", personsEntitled: ["LIBERIS LIMITED"] },
      ])
    ).toEqual(["IWOCA LIMITED", "LIBERIS LIMITED"]);
  });

  it("dedupes lender name lists from Lead Finder", () => {
    expect(chargeHoldersFromNames(["Iwoca", "IWOCA", "Barclays Bank PLC", "YouLend"])).toEqual(["Iwoca", "YouLend"]);
  });

  it("lists every registered charge holder for deal files, including banks", () => {
    expect(
      registeredChargeHoldersFromNames(["Iwoca", "IWOCA", "Barclays Bank PLC", "YouLend", ""])
    ).toEqual(["Iwoca", "Barclays Bank PLC", "YouLend"]);
    expect(
      dealChargeHolders(
        { chargeHolders: ["IWOCA LIMITED"] },
        ["HSBC BANK PLC", "IWOCA LIMITED"]
      )
    ).toEqual(["IWOCA LIMITED", "HSBC BANK PLC"]);
    expect(dealChargeHolders({}, ["National Westminster Bank PLC"])).toEqual([
      "National Westminster Bank PLC",
    ]);
  });
});

describe("contactable deal files", () => {
  it("requires a sendable corporate mailbox on hunt files", () => {
    expect(
      isContactableDeal({
        source: "distress_scan",
        email: "adam@petshop.co.uk",
        contactName: "Adam Taylor",
        directorNames: ["Adam Taylor"],
      })
    ).toBe(true);
    expect(isContactableDeal({ source: "distress_scan", email: "", companyName: "No Inbox Ltd" })).toBe(false);
    expect(isContactableDeal({ source: "distress_scan", email: "info@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(true);
    expect(isContactableDeal({ source: "strata_inbound", email: "founder@gmail.com" })).toBe(true);
  });
});
