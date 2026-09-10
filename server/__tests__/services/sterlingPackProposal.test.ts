import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("sterling pack proposal gate", () => {
  it("refuses a conflicted proposal before zip", () => {
    const src = fs.readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
    expect(src).toMatch(/assertProposalReady/);
    expect(src).toMatch(/status: 400/);
    const pdfIdx = src.indexOf("renderFundingProposalPdf");
    const gateIdx = src.indexOf("assertProposalReady");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(pdfIdx);
  });

  it("passes David's copy edits into the HTML preview and pack PDF", () => {
    const pack = fs.readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
    expect(pack).toMatch(/sterlingCopy/);
    expect(pack).toMatch(/sterlingCopyForHandoff/);
    const route = fs.readFileSync(path.resolve("server/routes/brokerPortal.ts"), "utf8");
    expect(route).toMatch(/handoffs\/:id\/copy/);
    expect(route).toMatch(/narrativeEdits/);
    const ui = fs.readFileSync(path.resolve("client/src/pages/sterling/SterlingFile.tsx"), "utf8");
    expect(ui).toMatch(/STERLING_CAMPARI_FIELDS/);
    expect(ui).toMatch(/"financials", "dealSummary", "forecastCritique"/);
    expect(ui).toMatch(/srcDoc/);
    expect(ui).toMatch(/sterling-rail-expand/);
    expect(ui).toMatch(/sterling-rail-grip/);
    expect(ui).toMatch(/sterling-tab-application/);
    expect(ui).toMatch(/scf-acc/);
    expect(ui).toMatch(/application\.html\?lender=/);
    expect(ui).toMatch(/sterling-send-customer/);
    expect(ui).toMatch(/application\.docx/);
    expect(pack).toMatch(/e-sign the application/);
    expect(ui).not.toMatch(/iframe title="Funding proposal" src=\{`\/api\/broker-portal/);
    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/location\.startsWith\("\/apply\/"\)/);
    const css = fs.readFileSync(path.resolve("client/src/pages/sterling/sterling.css"), "utf8");
    expect(css).toMatch(/display: flex;/);
    expect(css).toMatch(/--scf-rail-width/);
    expect(css).not.toMatch(/grid-template-columns: minmax\(320px, 400px\)/);
  });

  it("gates Sterling HTML the same as PDF", () => {
    const src = fs.readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
    const htmlFn = src.slice(src.indexOf("export function sterlingReportHtml"));
    expect(htmlFn).toMatch(/assertProposalReady/);
    const route = fs.readFileSync(path.resolve("server/routes/brokerPortal.ts"), "utf8");
    const htmlRoute = route.slice(route.indexOf("report.html"));
    expect(htmlRoute).toMatch(/ProposalNotReadyError/);
  });
});
