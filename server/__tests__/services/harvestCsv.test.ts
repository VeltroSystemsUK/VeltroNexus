import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import agenticWorkflowRouter from "../../routes/agenticWorkflow";
import { attachOne } from "../../services/smeLeadHopper";
import {
  HARVEST_CSV_MAX_ROWS,
  harvestCsvDealDraft,
  parseHarvestCsv,
  planHarvestCsvIngest,
} from "../../services/harvestCsv";

describe("parseHarvestCsv", () => {
  it("maps company, CRN, website, email and contact columns", () => {
    const csv = [
      "Company Name,CRN,Website,Email,Contact Name,Phone",
      '"Acme Joinery Ltd",01234567,https://acmejoinery.co.uk,info@acmejoinery.co.uk,Ada Lovelace,0121 000 0000',
    ].join("\n");
    const parsed = parseHarvestCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        companyName: "Acme Joinery Ltd",
        companyNumber: "01234567",
        website: "https://acmejoinery.co.uk",
        email: "info@acmejoinery.co.uk",
        contactName: "Ada Lovelace",
        phone: "0121 000 0000",
      },
    ]);
  });

  it("uses contact_email when email is blank", () => {
    const csv = "company,contact_email\nPet Shop Ltd,hello@petshop.co.uk\n";
    expect(parseHarvestCsv(csv).rows[0].email).toBe("hello@petshop.co.uk");
  });

  it("maps contact_first_name onto contactName", () => {
    const csv = "company_name,contact_first_name,contact_email\nPet Shop Ltd,Adam,adam@petshop.co.uk\n";
    expect(parseHarvestCsv(csv).rows[0].contactName).toBe("Adam");
  });

  it("pads numeric company numbers to 8 digits", () => {
    const csv = "company_name,company_number\nAcme Ltd,1234567\n";
    expect(parseHarvestCsv(csv).rows[0].companyNumber).toBe("01234567");
  });

  it("skips rows with no company name", () => {
    const csv = "company_name,email\n,info@blank.co.uk\nReal Ltd,a@real.co.uk\n";
    const parsed = parseHarvestCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].companyName).toBe("Real Ltd");
    expect(parsed.errors).toEqual([{ row: 2, message: "Missing company name" }]);
  });

  it("accepts a 100-row director list", () => {
    const body = Array.from({ length: HARVEST_CSV_MAX_ROWS }, (_, i) => `Co ${i} Ltd`).join("\n");
    const parsed = parseHarvestCsv(`company_name\n${body}`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(HARVEST_CSV_MAX_ROWS);
  });

  it("rejects a file over the row cap", () => {
    const body = Array.from({ length: HARVEST_CSV_MAX_ROWS + 1 }, (_, i) => `Co ${i} Ltd`).join("\n");
    const parsed = parseHarvestCsv(`company_name\n${body}`);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0].message).toMatch(String(HARVEST_CSV_MAX_ROWS));
  });
});

describe("planHarvestCsvIngest", () => {
  it("skips a company number already on the book", () => {
    const plan = planHarvestCsvIngest(
      [
        { companyName: "Acme Ltd", companyNumber: "01234567" },
        { companyName: "New Co Ltd", companyNumber: "09999999" },
      ],
      [{ companyName: "Acme Limited", companyNumber: "1234567" }]
    );
    expect(plan.create.map((row) => row.companyName)).toEqual(["New Co Ltd"]);
    expect(plan.skipped[0].reason).toMatch(/already on book/i);
  });

  it("skips the same company name when the CSV row has no number", () => {
    const plan = planHarvestCsvIngest(
      [{ companyName: "Acme Joinery Ltd" }],
      [{ companyName: "Acme Joinery Ltd" }]
    );
    expect(plan.create).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/already on book/i);
  });

  it("skips suppressed email or company number as do not contact", () => {
    const plan = planHarvestCsvIngest(
      [
        { companyName: "Love Louie Ltd", email: "info@lovelouie.co.uk" },
        { companyName: "Banned Co Ltd", companyNumber: "07580523" },
        { companyName: "Ok Ltd", email: "ok@ok.co.uk", companyNumber: "09999999" },
      ],
      [],
      { emails: ["INFO@lovelouie.co.uk"], numbers: ["7580523"] }
    );
    expect(plan.create.map((row) => row.companyName)).toEqual(["Ok Ltd"]);
    expect(plan.skipped.map((row) => row.reason)).toEqual(["do not contact", "do not contact"]);
  });

  it("ingest consults the suppression list before creating files", () => {
    const src = fs.readFileSync(path.resolve("server/services/harvestCsv.ts"), "utf8");
    expect(src).toMatch(/suppressionSets/);
    expect(src).toMatch(/planHarvestCsvIngest\(/);
  });

  it("opens the batch in one store write instead of one write per row", () => {
    const src = fs.readFileSync(path.resolve("server/services/harvestCsv.ts"), "utf8");
    expect(src).toMatch(/createAgenticDealsBulk/);
    expect(src).not.toMatch(/for \(const row of plan\.create\) \{\s*await storage\.createAgenticDeal/);
  });
});

describe("harvestCsvDealDraft", () => {
  it("opens an SME hunt-contact file so Harper verifies even when an email is supplied", () => {
    const draft = harvestCsvDealDraft(
      {
        companyName: "Acme Joinery Ltd",
        companyNumber: "01234567",
        email: "info@acmejoinery.co.uk",
        website: "https://acmejoinery.co.uk",
        contactName: "Ada",
      },
      "list.csv",
      "owner-1"
    );
    expect(draft.source).toBe("distress_scan");
    expect(draft.stream).toBe("sme");
    expect(draft.hopper).toBe("hunt_contact");
    expect(draft.email).toBe("info@acmejoinery.co.uk");
    expect(draft.events?.[0].agent).toBe("harvest");
    expect(draft.events?.[0].message).toMatch(/list\.csv/i);
  });

  it("still opens a file when the CSV email is a personal mailbox — Harper must not treat Gmail as verified", () => {
    const draft = harvestCsvDealDraft(
      { companyName: "Acme Ltd", email: "ada@gmail.com" },
      "list.csv",
      "owner-1"
    );
    expect(draft.email).toBe("ada@gmail.com");
    expect(draft.hopper).toBe("hunt_contact");
  });
});

describe("Harper grades CSV emails", () => {
  const budget = { ch: 10, places: 10, firecrawl: 10, smtp: 10 };
  const deps = {
    officers: async () => [],
    places: async () => null,
    firecrawl: async () => [],
    mxValid: async () => true,
  };

  it("marks a company-domain CSV mailbox sendable when MX passes", async () => {
    const draft = harvestCsvDealDraft(
      {
        companyName: "Pet Shop Ltd",
        email: "info@petshop.co.uk",
        website: "https://petshop.co.uk",
      },
      "list.csv",
      "owner-1"
    );
    const { dealPatch } = await attachOne(draft as any, deps, budget);
    expect(dealPatch.hopper).toBe("sendable");
    expect(dealPatch.email).toBe("info@petshop.co.uk");
  });

  it("quarantines a Gmail CSV row instead of attaching it", async () => {
    const draft = harvestCsvDealDraft(
      { companyName: "Acme Ltd", email: "ada@gmail.com" },
      "list.csv",
      "owner-1"
    );
    const { dealPatch } = await attachOne(draft as any, deps, budget);
    expect(dealPatch.hopper).toBe("quarantine");
    expect(dealPatch.humanReason).toMatch(/no corporate mailbox/i);
  });
});

describe("harvest csv route", () => {
  it("does not start a harvest pass on upload — the hourly tick works the hopper", () => {
    const src = fs.readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
    const ingest = src.slice(src.indexOf("async ingestHarvestCsv"));
    expect(ingest).not.toMatch(/harvestMailboxes/);
  });

  it("registers POST /api/agentic/harvest/csv", () => {
    const paths = agenticWorkflowRouter.stack
      .filter((layer: { route?: { path?: string; methods?: Record<string, boolean> } }) => layer.route)
      .map((layer: { route: { path: string; methods: Record<string, boolean> } }) => ({
        path: layer.route.path,
        methods: layer.route.methods,
      }));
    const hit = paths.find((row) => row.path === "/api/agentic/harvest/csv");
    expect(hit?.methods.post).toBe(true);
  });
});
