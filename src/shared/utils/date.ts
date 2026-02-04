/**
 * Date utilities — all dates in ISO 8601 format in API layer.
 * Display formatting happens in Flutter only.
 */

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthRange(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

export function isDateInFuture(date: string | Date): boolean {
  return new Date(date) > new Date();
}

export function toISO(date: Date): string {
  return date.toISOString();
}
