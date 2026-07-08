/** Locally-stored recovery records. */

export interface DailyCheckIn {
  id: string;
  at: number;
  gambled: boolean;
  mood?: number; // 1..10
  urgeStrength?: number; // 1..10
  triggers?: string[];
  notes?: string;
}

export interface UrgeLog {
  id: string;
  at: number;
  intensity: number; // 1..10
  trigger?: string;
  notes?: string;
  resisted: boolean;
}

export interface RelapseEvent {
  id: string;
  at: number;
  amount?: number;
  whatHappened?: string;
  cause?: string;
  feeling?: string;
}

export interface JournalEntry {
  id: string;
  at: number;
  text: string;
  mood?: number;
  trigger?: string;
}

export type TimelineType =
  | 'checkin'
  | 'clean'
  | 'money'
  | 'urge'
  | 'relapse'
  | 'journal'
  | 'milestone'
  | 'badge'
  | 'breathing'
  | 'start';

export interface TimelineEvent {
  id: string;
  at: number;
  type: TimelineType;
  label: string;
}

export function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
