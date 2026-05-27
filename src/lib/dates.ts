const MS_PER_DAY = 86_400_000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday (00:00 UTC) of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = toUtcMidnight(date);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d;
}

/** ISO-8601 week number and its owning ISO year (the Thursday rule). */
export function isoWeekParts(date: Date): { isoYear: number; week: number } {
  const thursday = startOfIsoWeek(date);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();

  const firstThursday = startOfIsoWeek(new Date(Date.UTC(isoYear, 0, 4)));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3);

  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return { isoYear, week };
}

/** Stable sort key for a week, e.g. "2026-W22". */
export function isoWeekKey(date: Date): string {
  const { isoYear, week } = isoWeekParts(date);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function formatMonthDay(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

/** Human label for a week's date range, e.g. "5/25–5/31". */
export function isoWeekRangeLabel(date: Date): string {
  const start = startOfIsoWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${formatMonthDay(start)}–${formatMonthDay(end)}`;
}

/** Full Chinese date for a single entry, e.g. "2026年5月27日". */
export function formatPublishedDate(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

/** Compact month-day for the log's entry rows, e.g. "05-27". */
export function formatEntryDate(date: Date): string {
  return toIsoDate(date).slice(5);
}

/** Short ISO-week label for an entry, e.g. "第 22 周". */
export function formatWeekLabel(date: Date): string {
  return `第 ${isoWeekParts(date).week} 周`;
}

/** ISO date string (YYYY-MM-DD) for <time datetime>. */
export function toIsoDate(date: Date): string {
  return toUtcMidnight(date).toISOString().slice(0, 10);
}
