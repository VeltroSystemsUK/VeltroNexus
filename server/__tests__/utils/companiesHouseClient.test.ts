import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chCooldownUntil,
  chFetch,
  clearChCooldown,
  setChCooldown,
  setChCooldownPathForTests,
} from "../../utils/companiesHouseClient";

describe("chFetch cooldown", () => {
  afterEach(() => {
    clearChCooldown();
    setChCooldownPathForTests(null);
  });

  it("does not call the network while cooling after a 429", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ch-cool-"));
    setChCooldownPathForTests(path.join(dir, "ch_cooldown.json"));
    const fetchImpl = vi.fn(async () => new Response("slow down", { status: 429 }));
    const first = await chFetch("/company/1", { COMPANIES_HOUSE_API_KEY: "k" }, fetchImpl as unknown as typeof fetch);
    expect(first.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(chCooldownUntil()).toBeTruthy();
    const second = await chFetch("/company/2", { COMPANIES_HOUSE_API_KEY: "k" }, fetchImpl as unknown as typeof fetch);
    expect(second.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fetches again after the cooldown expires", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ch-cool-"));
    setChCooldownPathForTests(path.join(dir, "ch_cooldown.json"));
    setChCooldown(-1000);
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await chFetch("/company/1", { COMPANIES_HOUSE_API_KEY: "k" }, fetchImpl as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
