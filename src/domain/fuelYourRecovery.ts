/**
 * Fuel Your Recovery - health & nutrition companion.
 *
 * A universal recovery tool for all addiction types. Helps users build
 * healthier eating habits, improve hydration, and support recovery
 * through better diet and lifestyle choices.
 */

/** Fuel is account-wide and must never be partitioned by recovery track. */
export const FUEL_DATA_SCOPE = 'global' as const;

// ── Food entry ────────────────────────────────────────────────────────────

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  /** Timestamp when the food was logged. */
  at: number;
  name: string;
  category: MealCategory;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
  /** Whether this is a favorite food. */
  isFavorite?: boolean;
}

// ── Water entry ───────────────────────────────────────────────────────────

export interface WaterEntry {
  id: string;
  at: number;
  /** Amount in milliliters. */
  amountMl: number;
}

// ── Fasting entry ─────────────────────────────────────────────────────────

export interface FastingSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  /** Target duration in minutes. */
  targetMinutes: number;
  /** Whether the fast was completed. */
  completed: boolean;
}

export type FastingSchedule = '12:12' | '14:10' | '16:8' | '18:6' | '20:4' | 'omad' | 'custom';

export interface FastingGoal {
  schedule: FastingSchedule;
  /** What time to start eating (24h format, e.g. 12 for 12:00 PM). */
  startEatingHour: number;
}

// ── Goals ─────────────────────────────────────────────────────────────────

export interface NutritionGoals {
  dailyCalories: number;
  dailyWaterMl: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  dailyFiber: number;
  fastingGoal: FastingGoal | null;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  wellnessGoal?: WellnessGoal;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WellnessGoal = 'steady_energy' | 'regular_meals' | 'hydration' | 'general_wellbeing';

export const DEFAULT_GOALS: NutritionGoals = {
  dailyCalories: 2000,
  dailyWaterMl: 2500,
  dailyProtein: 50,
  dailyCarbs: 250,
  dailyFat: 65,
  dailyFiber: 25,
  fastingGoal: null,
};

// ── Water presets ─────────────────────────────────────────────────────────

export const WATER_PRESETS = [250, 500, 750, 1000] as const;

// ── Fasting schedule presets ───────────────────────────────────────────────

export const FASTING_SCHEDULES: Record<string, { label: string; hours: number; description: string }> = {
  '12:12': { label: '12:12', hours: 12, description: '12 hours fasting, 12 hours eating' },
  '14:10': { label: '14:10', hours: 14, description: '14 hours fasting, 10 hours eating' },
  '16:8': { label: '16:8', hours: 16, description: '16 hours fasting, 8 hours eating' },
  '18:6': { label: '18:6', hours: 18, description: '18 hours fasting, 6 hours eating' },
  '20:4': { label: '20:4', hours: 20, description: '20 hours fasting, 4 hours eating' },
  'omad': { label: 'OMAD', hours: 23, description: 'One Meal A Day' },
};

// ── Daily summary ─────────────────────────────────────────────────────────

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalWaterMl: number;
  mealCount: number;
  fastingMinutes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Sum all food entries for a given day. */
export function dailyFoodSummary(entries: FoodEntry[], targetDay?: number): {
  calories: number; protein: number; carbs: number; fat: number; fiber: number; mealCount: number;
} {
  const start = targetDay ?? dayStart(Date.now());
  const end = start + MS_PER_DAY;
  const today = entries.filter((e) => e.at >= start && e.at < end);
  return {
    calories: today.reduce((s, e) => s + e.calories, 0),
    protein: today.reduce((s, e) => s + e.protein, 0),
    carbs: today.reduce((s, e) => s + e.carbs, 0),
    fat: today.reduce((s, e) => s + e.fat, 0),
    fiber: today.reduce((s, e) => s + e.fiber, 0),
    mealCount: today.length,
  };
}

/** Sum water intake for a given day in mL. */
export function dailyWaterTotal(entries: WaterEntry[], targetDay?: number): number {
  const start = targetDay ?? dayStart(Date.now());
  const end = start + MS_PER_DAY;
  return entries.filter((e) => e.at >= start && e.at < end).reduce((s, e) => s + e.amountMl, 0);
}

/** Total fasting minutes for a given day. */
export function dailyFastingMinutes(sessions: FastingSession[], targetDay?: number): number {
  const start = targetDay ?? dayStart(Date.now());
  const end = start + MS_PER_DAY;
  return sessions
    .filter((s) => s.endedAt != null && s.endedAt >= start && s.endedAt < end && s.completed)
    .reduce((sum, s) => sum + Math.round((s.endedAt! - s.startedAt) / 60_000), 0);
}

/** Meal logging streak: consecutive days with at least 1 meal logged. */
export function mealStreak(entries: FoodEntry[]): number {
  const daySet = new Set(entries.map((e) => dayKey(e.at)));
  let streak = 0;
  let d = dayStart(Date.now());
  // Check if today has meals; if not, start from yesterday
  if (!daySet.has(dayKey(d))) {
    d -= MS_PER_DAY;
  }
  while (daySet.has(dayKey(d))) {
    streak++;
    d -= MS_PER_DAY;
  }
  return streak;
}

/** Water logging streak: consecutive days with >= goal water intake. */
export function waterStreak(entries: WaterEntry[], goalMl: number): number {
  let streak = 0;
  let d = dayStart(Date.now());
  // Check today first
  if (dailyWaterTotal(entries, d) >= goalMl) {
    // Count from today
  } else {
    d -= MS_PER_DAY;
  }
  while (dailyWaterTotal(entries, d) >= goalMl) {
    streak++;
    d -= MS_PER_DAY;
  }
  return streak;
}

// ── Achievements ──────────────────────────────────────────────────────────

export interface FuelAchievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  progress?: (data: { meals: number; waterDays: number; fasts: number; mealStreak: number; waterStreak: number }) => { current: number; target: number };
  test: (data: { meals: number; waterDays: number; fasts: number; mealStreak: number; waterStreak: number }) => boolean;
}

export const FUEL_ACHIEVEMENTS: FuelAchievement[] = [
  {
    id: 'fuel-first-meal', title: 'First Meal Logged', icon: 'restaurant',
    desc: 'Log your first meal.',
    progress: (d) => ({ current: Math.min(d.meals, 1), target: 1 }),
    test: (d) => d.meals >= 1,
  },
  {
    id: 'fuel-hydration-hero', title: 'Hydration Hero', icon: 'water',
    desc: 'Meet your hydration goal for 7 days.',
    progress: (d) => ({ current: Math.min(d.waterDays, 7), target: 7 }),
    test: (d) => d.waterDays >= 7,
  },
  {
    id: 'fuel-meal-3', title: 'Three-Day Meal Streak', icon: 'calendar',
    desc: 'Log meals for 3 consecutive days.',
    progress: (d) => ({ current: Math.min(d.mealStreak, 3), target: 3 }),
    test: (d) => d.mealStreak >= 3,
  },
  {
    id: 'fuel-water-7', title: 'Seven-Day Hydration Streak', icon: 'droplet',
    desc: 'Meet your hydration goal for 7 consecutive days.',
    progress: (d) => ({ current: Math.min(d.waterStreak, 7), target: 7 }),
    test: (d) => d.waterStreak >= 7,
  },
  {
    id: 'fuel-first-fast', title: 'First Fast Completed', icon: 'timer',
    desc: 'Complete your first fasting session.',
    progress: (d) => ({ current: Math.min(d.fasts, 1), target: 1 }),
    test: (d) => d.fasts >= 1,
  },
  {
    id: 'fuel-meals-30', title: 'Nutrition Master', icon: 'trophy',
    desc: 'Log 30 meals total.',
    progress: (d) => ({ current: Math.min(d.meals, 30), target: 30 }),
    test: (d) => d.meals >= 30,
  },
];

export function evaluateFuelAchievements(data: { meals: number; waterDays: number; fasts: number; mealStreak: number; waterStreak: number }): string[] {
  return FUEL_ACHIEVEMENTS.filter((a) => a.test(data)).map((a) => a.id);
}

export function fuelAchievementById(id: string): FuelAchievement | undefined {
  return FUEL_ACHIEVEMENTS.find((a) => a.id === id);
}

// ── Recovery tips ─────────────────────────────────────────────────────────

const RECOVERY_TIPS = [
  'Staying hydrated can help reduce cravings.',
  'Regular meals may help stabilize energy and mood.',
  'Protein-rich foods can help you stay full longer.',
  'Whole foods provide steady energy throughout the day.',
  'Recovery is easier when your body is well nourished.',
  'Dehydration can mimic hunger - try water first.',
  'Balanced blood sugar helps manage impulses.',
  'A good breakfast sets the tone for the day.',
  'Fiber helps you feel satisfied after meals.',
  'Your body is healing - give it the fuel it needs.',
  'Eating regularly helps maintain stable energy.',
  'Healthy habits build on each other over time.',
] as const;

export function todaysTip(dayOfYear?: number): string {
  const idx = dayOfYear ?? Math.floor(Date.now() / MS_PER_DAY);
  return RECOVERY_TIPS[idx % RECOVERY_TIPS.length];
}
