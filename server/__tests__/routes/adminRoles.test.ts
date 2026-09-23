import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("admin user roles", () => {
  it("can assign external_broker so the Sterling partner is not stuck as sales_admin", () => {
    const src = fs.readFileSync(path.resolve("server/routes/admin.ts"), "utf8");
    expect(src).toMatch(/z\.enum\(\[[^\]]*external_broker[^\]]*\]\)/);
    const ui = fs.readFileSync(path.resolve("client/src/pages/Admin.tsx"), "utf8");
    expect(ui).toMatch(/SelectItem value="external_broker"/);
  });
});
