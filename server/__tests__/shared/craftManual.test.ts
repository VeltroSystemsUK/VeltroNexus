import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CRAFT_MANUAL_LAWS,
  CRAFT_MANUAL_MOTION,
  CRAFT_MANUAL_STACKS,
  CRAFT_OVERLAY_PRESETS,
  CRAFT_WEEK_PLAYBOOKS,
  craftManualSection,
  islaStudioBrief,
  weekPlaybook,
} from "@shared/craftManual";
import { DAY_SLOTS } from "@/components/craft/lib/weekGrammar";

const PRESET_SRC = readFileSync("client/src/components/craft/lib/motionPresets.ts", "utf8");

function livePresetIds(): string[] {
  const ids = new Set<string>();
  for (const match of PRESET_SRC.matchAll(/\bid: "([a-z0-9-]+)",\s*\n\s*name:/g)) ids.add(match[1]!);
  for (const match of PRESET_SRC.matchAll(/\bhouse\("([a-z0-9-]+)"/g)) ids.add(match[1]!);
  return [...ids];
}

describe("Isla studio manual", () => {
  it("catalogues every live motion preset with a job", () => {
    const live = livePresetIds();
    const listed = CRAFT_MANUAL_MOTION.map((item) => item.id);
    expect(listed.sort()).toEqual(live.sort());
    expect(CRAFT_MANUAL_MOTION.length).toBe(live.length);
    expect(CRAFT_MANUAL_MOTION.length).toBeGreaterThanOrEqual(87);
    for (const item of CRAFT_MANUAL_MOTION) {
      expect(item.job.length).toBeGreaterThan(12);
      expect(item.name.length).toBeGreaterThan(2);
    }
  });

  it("covers every weekday contract with a recommended stack", () => {
    expect(CRAFT_WEEK_PLAYBOOKS.map((item) => item.slot)).toEqual([...DAY_SLOTS]);
    for (const play of CRAFT_WEEK_PLAYBOOKS) {
      expect(play.must.length).toBeGreaterThan(8);
      expect(play.forbidden.length).toBeGreaterThan(8);
      expect(play.stack.length).toBeGreaterThan(0);
      expect(weekPlaybook(play.slot)?.day).toBe(play.day);
    }
  });

  it("names overlay plates and stacking laws Isla cannot skip", () => {
    expect(CRAFT_OVERLAY_PRESETS).toEqual(["cinematic-hook-slam", "viral-hook-drop"]);
    const laws = CRAFT_MANUAL_LAWS.map((item) => `${item.title} ${item.rule}`).join(" ").toLowerCase();
    expect(laws).toMatch(/inspector/);
    expect(laws).toMatch(/adds/);
    expect(laws).toMatch(/right-click/);
    expect(laws).toMatch(/replace/);
    expect(laws).toMatch(/hook 1/);
    expect(laws).toMatch(/live cap 8|eight live/);
    expect(laws).toMatch(/do not lend|packager/);
  });

  it("ships named stacks so a week is not seven templates", () => {
    const ids = CRAFT_MANUAL_STACKS.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["glass-slam", "vapor-still", "stamp-leak", "redact-myth", "ticker-count"]));
    expect(CRAFT_MANUAL_STACKS.length).toBeGreaterThanOrEqual(7);
  });

  it("compact studio brief stays injectable and points at the full file", () => {
    const brief = islaStudioBrief();
    expect(brief.length).toBeGreaterThan(800);
    expect(brief.length).toBeLessThan(6000);
    expect(brief).toMatch(/shared\/craftManual\.ts/);
    expect(brief).toMatch(/monday-two-beat|Monday/);
    expect(brief).toMatch(/cinematic-hook-slam/);
    expect(brief).toMatch(/Inspector/);
  });

  it("exposes Help sections Isla and Shaun can open", () => {
    expect(craftManualSection("laws")?.title).toMatch(/law/i);
    expect(craftManualSection("week")?.title).toMatch(/week/i);
    expect(craftManualSection("motion")?.title).toMatch(/motion/i);
    expect(craftManualSection("missing")).toBeUndefined();
  });
});

describe("Isla actually receives the studio brief", () => {
  it("MKT-2 points at the studio manual, not a stale 66-preset inventory", () => {
    const md = readFileSync("docs/agentic-org/agents/MKT-2.md", "utf8");
    expect(md).toContain("shared/craftManual.ts");
    expect(md).not.toMatch(/66 house presets/);
  });

  it("Help sheet has a Manual tab sourced from craftManual", () => {
    const help = readFileSync("client/src/components/craft/shell/CraftHelp.tsx", "utf8");
    const nav = readFileSync("shared/craftHelp.ts", "utf8");
    expect(nav).toMatch(/"manual"/);
    expect(help).toContain("craftManual");
    expect(help).toMatch(/Manual|Studio brief/);
  });

  it("week copy pass is given the weekday playbook", () => {
    const src = readFileSync("server/services/islaDirector.ts", "utf8");
    expect(src).toContain("weekPlaybook");
    expect(src).toContain("daySlot");
  });

  it("Workforce Isla job description includes the compact studio brief", () => {
    const src = readFileSync("server/services/agentService.ts", "utf8");
    expect(src).toContain("islaStudioBrief");
  });
});
