/**
 * Calendar helpers for offline daily challenges.
 *
 * Challenge IDs are based on local calendar parts, not elapsed milliseconds
 * between local midnights. Converting the parts through Date.UTC makes each
 * adjacent date exactly one ordinal apart, including DST transitions.
 */
const DAY_MS = 86_400_000;

export function calendarOrdinalFromParts(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month, day) / DAY_MS);
}

export function localCalendarOrdinal(now = Date.now()): number {
  const date = new Date(now);
  return calendarOrdinalFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

export const CHALLENGE_EPOCH_ORDINAL = calendarOrdinalFromParts(2024, 0, 1);

export function challengeDayFromLocalDate(now = Date.now()): number {
  return localCalendarOrdinal(now) - CHALLENGE_EPOCH_ORDINAL;
}
