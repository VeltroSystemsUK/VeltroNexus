import { describe, expect, it } from "vitest";
import {
  isSafeCampaignArg,
  isSafeCompanyNumber,
  leadFinderSpawnSpec,
} from "../../utils/shellArgs";

describe("shell argument guards", () => {
  it("accepts Companies House numbers and rejects shell metacharacters", () => {
    expect(isSafeCompanyNumber("01234567")).toBe(true);
    expect(isSafeCompanyNumber("SC123456")).toBe(true);
    expect(isSafeCompanyNumber('01234567" & calc')).toBe(false);
    expect(isSafeCompanyNumber("")).toBe(false);
  });

  it("accepts plain campaign locations and rejects command separators", () => {
    expect(isSafeCampaignArg("Melton Mowbray")).toBe(true);
    expect(isSafeCampaignArg('Leicester" && whoami')).toBe(false);
    expect(isSafeCampaignArg("x; rm -rf /")).toBe(false);
  });

  it("spawns lead-finder via argv with shell disabled", () => {
    const spec = leadFinderSpawnSpec("find bakers in Leeds & echo pwned", {
      execPath: "/usr/bin/node",
      tsxCli: "/app/node_modules/tsx/dist/cli.mjs",
      cliPath: "src/cli.ts",
    });
    expect(spec.shell).toBe(false);
    expect(spec.command).toBe("/usr/bin/node");
    expect(spec.args).toEqual([
      "/app/node_modules/tsx/dist/cli.mjs",
      "src/cli.ts",
      "agent",
      "find bakers in Leeds & echo pwned",
    ]);
  });
});
