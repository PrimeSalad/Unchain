import type { AddictionType, RecoveryFeatureId } from './recoveryTracks';

export interface ReminderCandidate {
  track: AddictionType;
  feature: RecoveryFeatureId;
  hour: number;
  minute: number;
  enabled: boolean;
  archived?: boolean;
}
export interface PlannedReminder extends ReminderCandidate {
  key: string;
  title: 'Unchainly';
  body: 'Your check-in is ready.';
}

/** Pure, privacy-safe multi-track planner. Native scheduling stays an adapter. */
export function planRecoveryReminders(
  candidates: readonly ReminderCandidate[],
  options: { permissionGranted: boolean; quietStartHour: number; quietEndHour: number; dailyCap?: number },
): PlannedReminder[] {
  if (!options.permissionGranted) return [];
  const cap = Math.max(0, options.dailyCap ?? 3);
  const isQuiet = (hour: number) => options.quietStartHour <= options.quietEndHour
    ? hour >= options.quietStartHour && hour < options.quietEndHour
    : hour >= options.quietStartHour || hour < options.quietEndHour;
  const seen = new Set<string>();
  const planned: PlannedReminder[] = [];
  for (const item of candidates) {
    if (!item.enabled || item.archived || isQuiet(item.hour)) continue;
    // Same feature/time is one notification even when multiple tracks request it.
    const key = `${item.feature}:${item.hour}:${item.minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    planned.push({ ...item, key, title: 'Unchainly', body: 'Your check-in is ready.' });
    if (planned.length === cap) break;
  }
  return planned;
}
