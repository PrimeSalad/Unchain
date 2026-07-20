import type { AddictionType } from './gambling';
import { triggersForAddiction } from './gambling';
import { PORN_TRIGGERS } from './pornRecovery';

/**
 * Category defaults used by the urge logger.
 *
 * Pornography historically lived in a separate recovery module, which made
 * the generic Log Urge screen render an empty list. Keep that separation in
 * the underlying domains while exposing one complete catalog to this flow.
 */
export function defaultUrgeTriggers(addiction: AddictionType): readonly string[] {
  return addiction === 'pornography'
    ? PORN_TRIGGERS
    : triggersForAddiction(addiction);
}

function normalizedTriggerKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build a stable, de-duplicated trigger list for one recovery track.
 * Saved/onboarding choices intentionally come first, followed by category
 * defaults and any older value already attached to an edited urge.
 */
export function triggerOptionsForAddiction(
  addiction: AddictionType,
  savedTriggers: readonly string[] = [],
  legacyEditTriggers: readonly string[] = [],
): string[] {
  const options: string[] = [];
  const seen = new Set<string>();

  for (const raw of [
    ...savedTriggers,
    ...defaultUrgeTriggers(addiction),
    ...legacyEditTriggers,
  ]) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    const key = normalizedTriggerKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(value);
  }

  return options;
}

export interface UrgeDestinationInput {
  activeTrack: AddictionType;
  selectedTracks: readonly AddictionType[];
  requestedTrack?: AddictionType | null;
  editOwnerTrack?: AddictionType | null;
}

/** Edit ownership wins; otherwise accept only an explicitly selected track. */
export function resolveUrgeDestination({
  activeTrack,
  selectedTracks,
  requestedTrack,
  editOwnerTrack,
}: UrgeDestinationInput): AddictionType | null {
  if (editOwnerTrack) return editOwnerTrack;
  if (requestedTrack && selectedTracks.includes(requestedTrack)) return requestedTrack;
  if (selectedTracks.includes(activeTrack)) return activeTrack;
  return selectedTracks[0] ?? null;
}
