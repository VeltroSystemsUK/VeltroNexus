import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("funding proposal report gate", () => {
  it("streamProspectReport asserts proposal ready before Chrome", () => {
    const src = fs.readFileSync(path.resolve("server/utils/prospectReport.ts"), "utf8");
    expect(src).toMatch(/assertProposalReady/);
    expect(src).toMatch(/ProposalNotReadyError/);
  });

  it("report route returns JSON 409", () => {
    const src = fs.readFileSync(path.resolve("server/routes/submissions.ts"), "utf8");
    expect(src).toMatch(/ProposalNotReadyError/);
    expect(src).toMatch(/status\(409\)/);
  });

  it("live prospect report route returns JSON 409", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/ProposalNotReadyError/);
    expect(src).toMatch(/status\(409\)/);
  });

  it("maps ProposalNotReadyError on lender send instead of 500", () => {
    const src = fs.readFileSync(path.resolve("server/routes/submissions.ts"), "utf8");
    const postBlock = src.slice(src.indexOf('"/api/submissions"'));
    expect(postBlock).toMatch(/ProposalNotReadyError/);
    expect(postBlock).toMatch(/pdfError\.status|error\.status/);
    const sendBlock = src.slice(src.indexOf("send-to-broker"));
    expect(sendBlock).toMatch(/ProposalNotReadyError/);
  });

  it("handleApiError maps ProposalNotReadyError to 409/400", () => {
    const src = fs.readFileSync(path.resolve("server/utils/errorHandler.ts"), "utf8");
    expect(src).toMatch(/ProposalNotReadyError/);
    expect(src).toMatch(/status === 400 \|\| status === 409/);
  });

  it("extracts the cashflow attachment before printing the PDF", () => {
    const src = fs.readFileSync(path.resolve("server/utils/fundingProposal.ts"), "utf8");
    expect(src).toMatch(/ensureCashflowForecast/);
  });

  it("rewrites Background on Generate Report", () => {
    const src = fs.readFileSync(path.resolve("server/utils/fundingProposal.ts"), "utf8");
    expect(src).toMatch(/ensureBackground/);
  });
});
