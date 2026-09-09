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
});
