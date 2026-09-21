import { describe, expect, it } from "vitest";
import {
  annotateLenderCost,
  cacheLenderCosts,
  classifyLender,
  lenderCostForLead,
  uniqueLenderNames,
  type LenderCostRank,
} from "@shared/lenderCost";

describe("lenderCostForLead", () => {
  it("ranks the most expensive charge first: Iwoca > Funding Circle > Barclays > Together-only", () => {
    const iwoca = lenderCostForLead("Iwoca Limited");
    const circle = lenderCostForLead("Funding Circle");
    const barclays = lenderCostForLead("Barclays Bank PLC");
    const together = lenderCostForLead("Together Commercial Limited");
    expect(iwoca.lenderCost).toBeGreaterThan(circle.lenderCost);
    expect(circle.lenderCost).toBeGreaterThan(barclays.lenderCost);
    expect(barclays.lenderCost).toBeGreaterThan(together.lenderCost);
    expect(together.lenderCost).toBe(0);
    expect(iwoca.lenderBand).toBe("mca");
    expect(circle.lenderBand).toBe("specialist");
    expect(barclays.lenderBand).toBe("high_street");
    expect(together.lenderBand).toBe("property");
  });

  it("takes the most expensive lender when Together sits next to Iwoca", () => {
    const stacked = lenderCostForLead("Together Commercial Limited; Iwoca Limited");
    expect(stacked.lenderCost).toBe(lenderCostForLead("Iwoca Limited").lenderCost);
    expect(stacked.lenderBand).toBe("mca");
  });

  it("lifts Together-only on a trading SME into specialist, and leaves property vehicles at zero", () => {
    const trading = lenderCostForLead("Together Commercial Finance Limited", undefined, {
      companyName: "LIEBE SUPERMARKET LIMITED",
    });
    const properties = lenderCostForLead("Together Commercial Finance Limited", undefined, {
      companyName: "PINCOTT PROPERTIES LIMITED",
    });
    const developments = lenderCostForLead("Together Commercial Finance Limited", undefined, {
      companyName: "MERRYLEE ROAD DEVELOPMENTS LIMITED",
    });
    const holdings = lenderCostForLead("Together Commercial Finance Limited", undefined, {
      companyName: "KAJEZO HOLDINGS LIMITED",
    });
    const barclays = lenderCostForLead("Barclays Bank PLC");
    const capify = lenderCostForLead("Capify");
    expect(trading.lenderBand).toBe("specialist");
    expect(trading.lenderCost).toBe(11);
    expect(trading.lenderCost).toBeGreaterThan(barclays.lenderCost);
    expect(capify.lenderCost).toBeGreaterThan(trading.lenderCost);
    expect(properties).toEqual({ lenderCost: 0, lenderBand: "property" });
    expect(developments).toEqual({ lenderCost: 0, lenderBand: "property" });
    expect(holdings).toEqual({ lenderCost: 0, lenderBand: "property" });
  });

  it("uses a Jev cache only for names the catalog does not know", () => {
    const cache = {
      "WEIRD MCA LTD": { band: "mca" as const, typicalApr: 42 },
    };
    expect(lenderCostForLead("Weird MCA Ltd").lenderCost).toBe(0);
    expect(lenderCostForLead("Weird MCA Ltd", cache).lenderCost).toBe(42);
    expect(lenderCostForLead("Iwoca Limited", cache).lenderBand).toBe("mca");
  });
});

describe("classifyLender", () => {
  it("labels YouLend as MCA and LendInvest as property", () => {
    expect(classifyLender("YouLend").band).toBe("mca");
    expect(classifyLender("LendInvest").band).toBe("property");
    expect(classifyLender("LendInvest").typicalApr).toBe(0);
  });

  it("ranks Nationwide Finance as a high-rate merchant, not the building society", () => {
    const merchant = lenderCostForLead("Nationwide Finance Limited");
    const ltd = lenderCostForLead("Nationwide Finance LTD");
    const society = lenderCostForLead("Nationwide Building Society");
    const barclays = lenderCostForLead("Barclays Bank PLC");
    expect(merchant.lenderBand).toBe("mca");
    expect(ltd.lenderBand).toBe("mca");
    expect(merchant.lenderCost).toBeGreaterThan(barclays.lenderCost);
    expect(society.lenderBand).toBe("high_street");
    expect(society.lenderCost).toBe(barclays.lenderCost);
  });
});

describe("annotateLenderCost", () => {
  it("attaches cost and band on each lead from identifiedLender", () => {
    const [hot, bank] = annotateLenderCost([
      { id: 1, identifiedLender: "Liberis" },
      { id: 2, identifiedLender: "Lloyds Bank PLC" },
    ]);
    expect(hot.lenderBand).toBe("mca");
    expect(hot.lenderCost).toBeGreaterThan(bank.lenderCost);
    expect(bank.lenderBand).toBe("high_street");
  });

  it("uses the company name when scoring a Together card", () => {
    const [shop, vehicle] = annotateLenderCost([
      { id: 1, companyName: "LIEBE SUPERMARKET LIMITED", identifiedLender: "Together Commercial Finance" },
      { id: 2, companyName: "PINCOTT PROPERTIES LIMITED", identifiedLender: "Together Commercial Finance" },
    ]);
    expect(shop.lenderBand).toBe("specialist");
    expect(vehicle.lenderBand).toBe("property");
    expect(shop.lenderCost).toBeGreaterThan(vehicle.lenderCost);
  });
});

describe("uniqueLenderNames", () => {
  it("splits combined charge holders into unique names", () => {
    const names = uniqueLenderNames([
      { identifiedLender: "Together Commercial Limited; Iwoca Limited" },
      { identifiedLender: "Iwoca Limited" },
      { identifiedLender: "" },
    ]);
    expect(names).toEqual(["Together Commercial Limited", "Iwoca Limited"]);
  });
});

describe("cacheLenderCosts", () => {
  it("writes known catalog names without calling Jev, then ranks leftovers", async () => {
    const store: Record<string, LenderCostRank> = {
      "ALREADY LTD": { band: "high_cost", typicalApr: 22 },
    };
    const called: string[] = [];
    const rank = async (name: string): Promise<LenderCostRank> => {
      called.push(name);
      return { band: "mca", typicalApr: 40, at: name };
    };
    const out = await cacheLenderCosts({
      names: ["Iwoca Limited", "Already Ltd", "Mystery Advance Ltd"],
      store,
      rank,
    });
    expect(out).toEqual({ known: 1, already: 1, jev: 1 });
    expect(called).toEqual(["Mystery Advance Ltd"]);
    expect(store["IWOCA LIMITED"].band).toBe("mca");
    expect(store["MYSTERY ADVANCE LTD"].typicalApr).toBe(40);
    expect(store["ALREADY LTD"].typicalApr).toBe(22);
  });

  it("does not cache an unknown leftover when Jev did not actually classify it", async () => {
    const store: Record<string, LenderCostRank> = {};
    const out = await cacheLenderCosts({
      names: ["Mystery Advance Ltd"],
      store,
      rank: async () => ({ band: "unknown", typicalApr: 0 }),
    });
    expect(out.jev).toBe(0);
    expect(store["MYSTERY ADVANCE LTD"]).toBeUndefined();
  });
});
