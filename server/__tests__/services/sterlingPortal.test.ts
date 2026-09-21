import fs from "fs";
import path from "path";
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
  postLoginPath,
  seesAllProspects,
  STERLING_DAILY_NAV,
  sterlingNavActive,
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

  it("lands David on Cases, not the pipeline dashboard", () => {
    expect(postLoginPath("external_broker")).toBe("/broker-portal");
    expect(postLoginPath("sales_admin")).toBe("/broker-portal");
    expect(postLoginPath("underwriter")).toBe("/underwriting");
    expect(postLoginPath("super_admin")).toBe("/pipeline");
    expect(postLoginPath("broker")).toBe("/pipeline");
  });

  it("gives David the live org pipeline, not his empty personal list", () => {
    expect(seesAllProspects("external_broker")).toBe(true);
    expect(seesAllProspects("super_admin")).toBe(false);
    expect(seesAllProspects("sales_admin")).toBe(false);
    expect(seesAllProspects("broker")).toBe(false);
  });

  it("marks Cases, Pipeline, Agent Mail, and Openers in the Sterling chrome", () => {
    expect(STERLING_DAILY_NAV.map((item) => item.path)).toEqual([
      "/broker-portal",
      "/broker-portal/pipeline",
      "/broker-portal/agent-mail",
      "/broker-portal/openers",
    ]);
    expect(sterlingNavActive("/broker-portal", "/broker-portal")).toBe(true);
    expect(sterlingNavActive("/broker-portal/12", "/broker-portal")).toBe(true);
    expect(sterlingNavActive("/broker-portal/pipeline", "/broker-portal")).toBe(false);
    expect(sterlingNavActive("/broker-portal/pipeline", "/broker-portal/pipeline")).toBe(true);
    expect(sterlingNavActive("/broker-portal/agent-mail", "/broker-portal/agent-mail")).toBe(true);
    expect(sterlingNavActive("/broker-portal/openers", "/broker-portal/openers")).toBe(true);
  });

  it("puts a labelled Sterling portal link on the rail and pipeline dashboard", () => {
    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav).toMatch(/const LENS_PATHS = \[\s*"\/broker-portal"/);
    expect(nav).toMatch(/path: "\/broker-portal".*roles: \["super_admin", "sales_admin", "external_broker"\]/);
    const pipeline = fs.readFileSync(path.resolve("client/src/pages/Pipeline.tsx"), "utf8");
    expect(pipeline).toMatch(/data-testid="link-sterling-portal"/);
    const shell = fs.readFileSync(path.resolve("client/src/pages/sterling/SterlingShell.tsx"), "utf8");
    expect(shell).toMatch(/data-testid="link-sterling-home"/);
    expect(shell).toMatch(/STERLING_DAILY_NAV/);
    expect(shell).toMatch(/data-testid=\{item\.testId\}/);
  });

  it("registers Pipeline, Agent Mail, and Openers on the Sterling portal before :id", () => {
    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    for (const pathName of ["/broker-portal/pipeline", "/broker-portal/agent-mail", "/broker-portal/openers"]) {
      const desk = app.indexOf(`path="${pathName}"`);
      const file = app.indexOf('path="/broker-portal/:id"');
      expect(desk).toBeGreaterThan(-1);
      expect(desk).toBeLessThan(file);
    }
    const prospects = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(prospects).toMatch(/seesAllProspects/);
    expect(prospects).toMatch(/listAllProspects/);
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
    expect(lines[0]).toEqual({ label: "Completed Loan Application", ok: false });
    expect(sterlingPackLines(items, { applicationSigned: true })[0]).toEqual({
      label: "Completed Loan Application",
      ok: true,
    });
    expect(lines[1]).toEqual({ label: "Funding proposal stamped", ok: true });
    expect(lines[2].label).toMatch(/supporting files$/);
    expect(lines.some((l) => l.label.toLowerCase().includes("insurance") && !l.ok)).toBe(true);
  });

  it("maps a due-diligence filename onto the handover item without a second upload", () => {
    expect(attachmentCategoryFromFilename("FY24-accounts.pdf")).toBe("accounts");
    expect(attachmentCategoryFromFilename("Home Crafters yearly profit and loss 2024-03-01 to 2025-02-28.pdf")).toBe(
      "accounts",
    );
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
