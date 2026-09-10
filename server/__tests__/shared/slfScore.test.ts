import { describe, expect, it } from "vitest";
import { scoreCompanySnapshot } from "@shared/slfScore";

const NOW = new Date("2026-09-07T12:00:00Z");

const sme = {
  companyName: "Acme Joinery Limited",
  companyNumber: "01234567",
  companyStatus: "active",
  dateOfCreation: "2019-04-01",
  sicCodes: ["43320"],
  resolutionConfidence: 1,
};

describe("scoreCompanySnapshot Stream A", () => {
  it("tags one live MCA as warm high_cost_refi", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        charges: [{ status: "outstanding", createdOn: "2025-01-15", personsEntitled: ["IWOCA LIMITED"] }],
      },
      NOW
    );
    expect(result.gate).toBe("queue");
    expect(result.primaryProduct).toBe("high_cost_refi");
    expect(result.priority).toBe("warm");
    expect(result.liveNonBankCount).toBe(1);
    expect(result.salesOs.signals.some((s) => s.code === "SIG-01")).toBe(true);
  });

  it("tags an HMRC petition on a unique company as hot hmrc_distress", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        companyName: "Oxbow Coldstores Limited",
        companyNumber: "09876543",
        hasPetition: true,
        petitionAt: "2026-09-06",
        charges: [],
      },
      NOW
    );
    expect(result.gate).toBe("queue");
    expect(result.primaryProduct).toBe("hmrc_distress");
    expect(result.priority).toBe("hot");
    expect(result.salesOs.signals.some((s) => s.code === "SIG-02")).toBe(true);
  });

  it("tags three live non-bank charges as hot stacked_debt", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        charges: [
          { status: "outstanding", createdOn: "2024-01-01", personsEntitled: ["IWOCA LIMITED"] },
          { status: "outstanding", createdOn: "2024-06-01", personsEntitled: ["YOULEND LIMITED"] },
          { status: "outstanding", createdOn: "2025-02-01", personsEntitled: ["FLEXIMIZE LIMITED"] },
        ],
      },
      NOW
    );
    expect(result.primaryProduct).toBe("stacked_debt");
    expect(result.priority).toBe("hot");
    expect(result.liveNonBankCount).toBe(3);
  });

  it("suppresses a just-refinanced non-bank book with a new high-street charge", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        charges: [
          { status: "satisfied", createdOn: "2023-01-01", satisfiedOn: "2026-08-28", personsEntitled: ["IWOCA LIMITED"] },
          { status: "outstanding", createdOn: "2026-08-26", personsEntitled: ["NATWEST"] },
        ],
      },
      NOW
    );
    expect(result.gate).toBe("suppress");
    expect(result.priority).toBe("suppressed");
    expect(result.signals.some((s) => s.signalType === "charge.just_refinanced")).toBe(true);
  });

  it("quarantines a generic Gazette name with low resolution", () => {
    const result = scoreCompanySnapshot(
      {
        companyName: "Premier Properties Limited",
        companyNumber: "",
        companyStatus: "active",
        dateOfCreation: "2015-01-01",
        sicCodes: ["43320"],
        hasPetition: true,
        petitionAt: "2026-09-06",
        resolutionConfidence: 0.4,
        charges: [],
      },
      NOW
    );
    expect(result.gate).toBe("unresolved");
    expect(result.priority).toBe("unresolved");
  });

  it("does not treat a 5-year high-street-only charge as a lead", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        charges: [{ status: "outstanding", createdOn: "2021-04-16", personsEntitled: ["NATWEST"] }],
      },
      NOW
    );
    expect(result.primaryProduct).toBe("none");
    expect(result.priority).toBe("noise");
    expect(result.gate).toBe("noise");
  });

  it("drops a broker", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        companyName: "Midlands Finance Brokers Ltd",
        sicCodes: ["64921"],
        charges: [{ status: "outstanding", createdOn: "2025-01-01", personsEntitled: ["IWOCA LIMITED"] }],
      },
      NOW
    );
    expect(result.gate).toBe("drop");
    expect(result.dropReason).toMatch(/broker/i);
  });

  it("drops a company trading under 12 months", () => {
    const result = scoreCompanySnapshot(
      {
        ...sme,
        dateOfCreation: "2026-03-01",
        charges: [{ status: "outstanding", createdOn: "2026-06-01", personsEntitled: ["IWOCA LIMITED"] }],
      },
      NOW
    );
    expect(result.gate).toBe("drop");
    expect(result.dropReason).toMatch(/too new/i);
  });
});
