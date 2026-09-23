import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("reporting task board", () => {
  it("lets you edit a task including its due date", () => {
    const src = fs.readFileSync(path.resolve("client/src/pages/Reporting.tsx"), "utf8");
    expect(src).toMatch(/openEdit/);
    expect(src).toMatch(/Edit task/);
    expect(src).toMatch(/button-edit-task/);
    expect(src).toMatch(/input-task-due-date/);
    expect(src).toMatch(/dueDate: dueDate \|\| null/);
    expect(src).toMatch(/`\/api\/reporting\/tasks\/\$\{id\}`/);
  });
});
