import type { AddictionType } from './gambling';

/** Normalize legacy and current profiles into a stable, non-empty selection. */
export function normalizeSelectedAddictions(
  active: AddictionType,
  selected?: readonly AddictionType[],
): AddictionType[] {
  const values = selected?.length ? selected : [active];
  const unique = Array.from(new Set(values));
  return unique.includes(active) ? unique : [active, ...unique];
}

