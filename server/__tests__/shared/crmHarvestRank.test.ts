import { describe, expect, it } from "vitest";
import {
  compareHarvestRank,
  harvestPriority,
  obviousSkipClass,
  type HarvestRank,
} from "@shared/crmHarvestRank";

describe("obviousSkipClass", () => {
  it("flags diocesan, charity, CIC and public bodies without calling Jev", () => {
    expect(obviousSkipClass({ companyName: "CHESTER DIOCESAN BOARD OF FINANCE" })).toBe("charity_public");
    expect(obviousSkipClass({ companyName: "ROYAL DEAF EDUCATION TRUST" })).toBe("charity_public");
    expect(obviousSkipClass({ companyName: "SEVERN COMMUNITY ENERGY ONE C.I.C." })).toBe("charity_public");
    expect(obviousSkipClass({ companyName: "LONDON PARISH COUNCIL" })).toBe("charity_public");
    expect(obviousSkipClass({ companyName: "ACME LTD", companyType: "charitable-incorporated-organisation" })).toBe(
      "charity_public",
    );
  });

  it("flags holdings, properties, estates and investments as SPVs", () => {
    expect(obviousSkipClass({ companyName: "SAHAS PROPERTIES LIMITED" })).toBe("holding_spv");
    expect(obviousSkipClass({ companyName: "RIVERWAY ESTATES LIMITED" })).toBe("holding_spv");
    expect(obviousSkipClass({ companyName: "ACME HOLDINGS LTD" })).toBe("holding_spv");
    expect(obviousSkipClass({ companyName: "SAIFEE INVESTMENTS LTD" })).toBe("holding_spv");
  });

  it("does not skip a trading SME name", () => {
    expect(obviousSkipClass({ companyName: "JPD MAINTENANCE SERVICES LTD", hasCharges: true })).toBeNull();
    expect(obviousSkipClass({ companyName: "Pet Shop Ltd" })).toBeNull();
  });
});

describe("harvestPriority", () => {
  it("puts charged SMEs ahead of skips", () => {
    const sme: HarvestRank = { harvestNow: true, smeBorrower: 4, skipClass: "charge_sme" };
    const skip: HarvestRank = { harvestNow: false, smeBorrower: 0, skipClass: "charity_public" };
    const charged = { companyName: "Pet Shop Ltd", hasCharges: true, identifiedLender: "Iwoca Limited" };
    const charity = { companyName: "CHESTER DIOCESAN BOARD OF FINANCE" };
    expect(harvestPriority(charged, sme)).toBeGreaterThan(harvestPriority(charity, skip));
    expect(compareHarvestRank({ lead: charged, rank: sme }, { lead: charity, rank: skip })).toBeLessThan(0);
  });

  it("gives Together-only property-vehicle charges zero priority even if Jev says harvest now", () => {
    const hot: HarvestRank = { harvestNow: true, smeBorrower: 4, skipClass: "charge_sme" };
    expect(
      harvestPriority(
        { companyName: "PINCOTT PROPERTIES LIMITED", hasCharges: true, identifiedLender: "Together Commercial Limited" },
        hot,
      ),
    ).toBe(0);
  });

  it("harvests Together-only on a trading SME above high street and below MCA", () => {
    const same: HarvestRank = { harvestNow: true, smeBorrower: 2, skipClass: "ok_sme" };
    const togetherShop = harvestPriority(
      { companyName: "LIEBE SUPERMARKET LIMITED", hasCharges: true, identifiedLender: "Together Commercial Limited" },
      same,
    );
    const barclays = harvestPriority(
      { companyName: "LIEBE SUPERMARKET LIMITED", hasCharges: true, identifiedLender: "Barclays Bank PLC" },
      same,
    );
    const iwoca = harvestPriority(
      { companyName: "LIEBE SUPERMARKET LIMITED", hasCharges: true, identifiedLender: "Iwoca Limited" },
      same,
    );
    expect(togetherShop).toBeGreaterThan(barclays);
    expect(iwoca).toBeGreaterThan(togetherShop);
  });

  it("keeps high priority when Together sits alongside a high-interest business lender", () => {
    const hot: HarvestRank = { harvestNow: true, smeBorrower: 4, skipClass: "charge_sme" };
    const togetherOnly = harvestPriority(
      { companyName: "Acme Joinery Ltd", hasCharges: true, identifiedLender: "Together Commercial Limited" },
      hot,
    );
    const stacked = harvestPriority(
      {
        companyName: "Acme Joinery Ltd",
        hasCharges: true,
        identifiedLender: "Together Commercial Limited; Iwoca Limited",
      },
      hot,
    );
    expect(stacked).toBeGreaterThan(togetherOnly);
    expect(stacked).toBeGreaterThan(0);
  });

  it("harvests expensive business lenders before high-street banks", () => {
    const same: HarvestRank = { harvestNow: true, smeBorrower: 2, skipClass: "ok_sme" };
    const iwoca = harvestPriority({ companyName: "Cafe Ltd", hasCharges: true, identifiedLender: "Iwoca Limited" }, same);
    const barclays = harvestPriority(
      { companyName: "Cafe Ltd", hasCharges: true, identifiedLender: "Barclays Bank PLC" },
      same,
    );
    const togetherVehicle = harvestPriority(
      { companyName: "PINCOTT PROPERTIES LIMITED", hasCharges: true, identifiedLender: "Together Commercial Limited" },
      same,
    );
    expect(iwoca).toBeGreaterThan(barclays);
    expect(barclays).toBeGreaterThan(togetherVehicle);
  });
});
