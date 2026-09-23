import { describe, expect, it } from "vitest";
import { isDueInWeek, reportDueDay } from "../../utils/reportDueDate";

const DAY_MS = 86400000;

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

describe("reportDueDay", () => {
  it("treats a date-only string as that local calendar day", () => {
    const day = reportDueDay("2026-09-14");
    expect(day).not.toBeNull();
    expect(day!.getFullYear()).toBe(2026);
    expect(day!.getMonth()).toBe(8);
    expect(day!.getDate()).toBe(14);
  });

  it("treats a UTC-midnight ISO string as the calendar day in the stamp, not the previous local day", () => {
    const day = reportDueDay("2026-09-14T00:00:00.000Z");
    expect(day!.getDate()).toBe(14);
    expect(day!.getMonth()).toBe(8);
  });
});

describe("isDueInWeek", () => {
  const weekStart = startOfWeekMonday(new Date(2026, 8, 14)); // Mon 14 Sep 2026
  const weekEnd = new Date(weekStart.getTime() + 4 * DAY_MS);
  weekEnd.setHours(23, 59, 59, 999);

  it("includes a Monday date-only due date in a BST week", () => {
    expect(isDueInWeek("2026-09-14", weekStart, weekEnd)).toBe(true);
  });

  it("includes a Friday date-only due date", () => {
    expect(isDueInWeek("2026-09-18", weekStart, weekEnd)).toBe(true);
  });

  it("excludes the previous Friday and next Monday", () => {
    expect(isDueInWeek("2026-09-11", weekStart, weekEnd)).toBe(false);
    expect(isDueInWeek("2026-09-21", weekStart, weekEnd)).toBe(false);
  });

  it("excludes missing due dates", () => {
    expect(isDueInWeek(null, weekStart, weekEnd)).toBe(false);
    expect(isDueInWeek("", weekStart, weekEnd)).toBe(false);
  });
});
