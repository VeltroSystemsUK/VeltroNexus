// Date-only due dates ("2026-09-14") and UTC-midnight ISO stamps from the
// date input must land on that calendar day, not the previous evening in BST.

export function reportDueDay(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
      return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    }
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return reportDueDay(d);
}

export function isDueInWeek(value: unknown, weekStart: Date, weekEnd: Date): boolean {
  const day = reportDueDay(value);
  if (!day) return false;
  return day.getTime() >= weekStart.getTime() && day.getTime() <= weekEnd.getTime();
}
