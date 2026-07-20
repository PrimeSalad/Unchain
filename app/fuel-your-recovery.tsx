/**
 * Fuel Your Recovery - health & nutrition companion.
 * Route: /fuel-your-recovery
 *
 * Dashboard with food logging, water tracking, fasting, and stats.
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useResponsive } from '@/presentation/hooks/useResponsive';
import { useStore } from '@/application/store';
import {
  WATER_PRESETS,
  FASTING_SCHEDULES,
  DEFAULT_GOALS,
  dailyFoodSummary,
  dailyWaterTotal,
  dailyFastingMinutes,
  calorieDayRecords,
  mealStreak,
  waterStreak,
  todaysTip,
  type MealCategory,
  type FoodEntry,
  type FastingGoal,
} from '@/domain/fuelYourRecovery';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtAmount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}mL`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtClock(hour24: number, minute = 0): string {
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

function formatFastDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, delay }: {
  icon: string; value: string | number; label: string; color: string; delay?: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay ?? 0).springify().damping(16)} style={{ flex: 1 }}>
      <View style={{
        backgroundColor: theme.color.surface, borderRadius: radius.input, padding: spacing.md,
        borderWidth: 1, borderColor: color + '24',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name={icon as any} size={14} color={color} />
          <Text variant="caption" color={color}>{label}</Text>
        </View>
        <Text variant="title2" color={color} style={{ fontFamily: 'Nunito_900Black', marginTop: 2 }}>
          {value}
        </Text>
      </View>
    </Animated.View>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" dim>{label}</Text>
    </View>
  );
}

// ── Progress ring ─────────────────────────────────────────────────────────

function ProgressRing({ progress, size, label, value, color }: {
  progress: number; size: number; label: string; value: string; color: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', width: size + 16 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: theme.color.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: 5, borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: progress > 0.25 ? color : 'transparent',
          borderBottomColor: progress > 0.5 ? color : 'transparent',
          borderLeftColor: progress > 0.75 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }} />
        <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', color }}>{value}</Text>
      </View>
      <Text variant="caption" dim style={{ marginTop: spacing.xs, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function FuelYourRecovery() {
  const theme = useTheme();
  const { width } = useResponsive();
  const { height: viewportHeight } = useWindowDimensions();
  const compact = width < 380;
  const isLandscape = width > viewportHeight;
  const shortViewport = viewportHeight < 700;
  const stackTrackers = compact && !isLandscape;
  const sheetMaxHeight = Math.max(280, Math.min(viewportHeight * 0.88, 680));
  const router = useRouter();
  const safeBack = useSafeBack();

  const foodEntries = useStore((s) => s.fuelFoodEntries);
  const waterEntries = useStore((s) => s.fuelWaterEntries);
  const fastingSessions = useStore((s) => s.fuelFastingSessions);
  const goals = useStore((s) => s.fuelGoals);
  const fuelAchievements = useStore((s) => s.fuelAchievements);
  const fuelBodyInfoSet = useStore((s) => s.fuelBodyInfoSet);
  const addFuelFoodEntry = useStore((s) => s.addFuelFoodEntry);
  const addFuelWater = useStore((s) => s.addFuelWater);
  const startFuelFast = useStore((s) => s.startFuelFast);
  const endFuelFast = useStore((s) => s.endFuelFast);
  const updateFuelGoals = useStore((s) => s.updateFuelGoals);
  const setFuelBodyInfo = useStore((s) => s.setFuelBodyInfo);

  // Show setup if body info hasn't been set yet
  const needsSetup = !fuelBodyInfoSet;

  // ── Modals ──────────────────────────────────────────────────────────────
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showFastModal, setShowFastModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ── Setup state ─────────────────────────────────────────────────────────
  const [setupStep, setSetupStep] = useState<'body' | 'activity' | 'plan' | 'goals'>(needsSetup ? 'body' : 'goals');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [age, setAge] = useState('25');
  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('70');
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [setupCalories, setSetupCalories] = useState(goals.dailyCalories);
  const [setupWater, setSetupWater] = useState(goals.dailyWaterMl);

  // ── Food form state ─────────────────────────────────────────────────────
  const [foodName, setFoodName] = useState('');
  const [foodCategory, setFoodCategory] = useState<MealCategory>('lunch');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [foodFiber, setFoodFiber] = useState('');

  // ── Fasting state ───────────────────────────────────────────────────────
  const [fastingGoal, setFastingGoal] = useState<FastingGoal | null>(goals.fastingGoal);
  const [customFastHours, setCustomFastHours] = useState(
    goals.fastingGoal?.schedule === 'custom' ? String(Math.floor((goals.fastingGoal.customMinutes ?? 0) / 60)) : '12',
  );
  const [customFastMinutes, setCustomFastMinutes] = useState(
    goals.fastingGoal?.schedule === 'custom' ? String((goals.fastingGoal.customMinutes ?? 0) % 60) : '0',
  );
  const initialEatingHour = goals.fastingGoal?.startEatingHour ?? 12;
  const [showCustomEatingTime, setShowCustomEatingTime] = useState(
    Boolean(goals.fastingGoal && ![6, 8, 10, 12, 14, 16, 18].includes(initialEatingHour)),
  );
  const [customEatingHour, setCustomEatingHour] = useState(
    String(initialEatingHour % 12 || 12),
  );
  const [customEatingMinute, setCustomEatingMinute] = useState('00');
  const [customEatingPeriod, setCustomEatingPeriod] = useState<'AM' | 'PM'>(
    initialEatingHour >= 12 ? 'PM' : 'AM',
  );
  const activeFast = fastingSessions.find((s) => s.endedAt === null);
  const selectedFastMinutes = fastingGoal?.schedule === 'custom'
    ? fastingGoal.customMinutes ?? 0
    : fastingGoal
      ? (FASTING_SCHEDULES[fastingGoal.schedule]?.hours ?? 0) * 60
      : 0;
  const canStartSelectedFast = selectedFastMinutes > 0 && selectedFastMinutes <= 24 * 60;
  const [, setTick] = useState(0);

  const applyCustomEatingTime = (hourText: string, minuteText: string, period: 'AM' | 'PM') => {
    if (!fastingGoal) return;
    const hour12 = Math.min(12, Math.max(1, Number(hourText) || 0));
    const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
    if (!hour12) return;
    const hour24 = (hour12 % 12) + (period === 'PM' ? 12 : 0);
    setFastingGoal({ ...fastingGoal, startEatingHour: hour24, startEatingMinute: minute });
  };

  // Timer for active fast countdown
  useEffect(() => {
    if (!activeFast) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeFast?.id]);

  // ── Today's data ────────────────────────────────────────────────────────
  const today = useMemo(() => {
    const food = dailyFoodSummary(foodEntries);
    const water = dailyWaterTotal(waterEntries);
    const fasting = dailyFastingMinutes(fastingSessions);
    const mStreak = mealStreak(foodEntries);
    const wStreak = waterStreak(waterEntries, goals.dailyWaterMl);
    return { food, water, fasting, mStreak, wStreak };
  }, [foodEntries, waterEntries, fastingSessions, goals]);
  const calorieHistory = useMemo(
    () => calorieDayRecords(foodEntries, goals.dailyCalories, 7),
    [foodEntries, goals.dailyCalories],
  );
  const calorieChartMax = Math.max(goals.dailyCalories, ...calorieHistory.map((day) => day.calories), 1);

  const calPct = goals.dailyCalories > 0 ? Math.min(1, today.food.calories / goals.dailyCalories) : 0;
  const waterPct = goals.dailyWaterMl > 0 ? Math.min(1, today.water / goals.dailyWaterMl) : 0;
  const proteinPct = goals.dailyProtein > 0 ? Math.min(1, today.food.protein / goals.dailyProtein) : 0;

  const calRemaining = Math.max(0, goals.dailyCalories - today.food.calories);
  const waterRemaining = Math.max(0, goals.dailyWaterMl - today.water);
  const caloriesExceeded = Math.max(0, today.food.calories - goals.dailyCalories);
  const calorieGoalReached = goals.dailyCalories > 0 && today.food.calories >= goals.dailyCalories;
  const calorieGoalExceeded = goals.dailyCalories > 0 && today.food.calories > goals.dailyCalories;
  const calorieRingColor = calorieGoalExceeded
    ? theme.color.danger
    : calorieGoalReached
      ? theme.color.success
      : theme.color.celebrateText;

  // ── Actions ─────────────────────────────────────────────────────────────
  const submitFood = () => {
    if (!foodName.trim()) return;
    addFuelFoodEntry({
      name: foodName.trim(),
      category: foodCategory,
      servingSize: '1 serving',
      calories: parseInt(foodCalories) || 0,
      protein: parseInt(foodProtein) || 0,
      carbs: parseInt(foodCarbs) || 0,
      fat: parseInt(foodFat) || 0,
      fiber: parseInt(foodFiber) || 0,
    });
    setFoodName(''); setFoodCalories(''); setFoodProtein(''); setFoodCarbs(''); setFoodFat(''); setFoodFiber('');
    setShowFoodModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const quickAddWater = (ml: number) => {
    addFuelWater(ml);
    Haptics.selectionAsync().catch(() => {});
  };

  const toggleFast = () => {
    if (activeFast) {
      endFuelFast();
    } else {
      const targetMinutes = fastingGoal?.schedule === 'custom'
        ? fastingGoal.customMinutes ?? 0
        : (FASTING_SCHEDULES[fastingGoal?.schedule ?? '16:8']?.hours ?? 16) * 60;
      if (targetMinutes > 0) startFuelFast(targetMinutes);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const finishSetup = () => {
    setFuelBodyInfo({ dailyCalories: setupCalories, dailyWaterMl: setupWater });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  // ── BMI & TDEE calculation ──────────────────────────────────────────────
  const ageNum = parseInt(age) || 25;
  const heightNum = parseFloat(heightCm) || 170;
  const weightNum = parseFloat(weightKg) || 70;

  const bmi = heightNum > 0 ? weightNum / ((heightNum / 100) ** 2) : 0;
  const bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  // Mifflin-St Jeor BMR (default to male formula if gender not selected)
  const bmr = gender === 'female'
    ? 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161
    : 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const tdee = bmr > 0 && activityLevel ? Math.round(bmr * (activityMultipliers[activityLevel] ?? 1.2)) : 0;

  const ACTIVITY_OPTIONS = [
    { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise, desk job' },
    { id: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
    { id: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
    { id: 'active', label: 'Active', desc: 'Hard exercise 6-7 days/week' },
    { id: 'very_active', label: 'Very Active', desc: 'Athlete-level training' },
  ];

  const CALORIE_PLANS = tdee > 0 ? [
    { id: 'maintain', title: 'Maintain Weight', cal: tdee, desc: 'Stay at your current weight with balanced nutrition.' },
    { id: 'mild-loss', title: 'Gentle Weight Loss', cal: tdee - 250, desc: 'A mild 250 cal deficit for steady, sustainable loss.' },
    { id: 'moderate-loss', title: 'Moderate Weight Loss', cal: tdee - 500, desc: 'A moderate 500 cal deficit. Consult a professional for longer-term plans.' },
    { id: 'mild-gain', title: 'Mild Weight Gain', cal: tdee + 250, desc: 'A slight surplus for healthy weight gain.' },
    { id: 'muscle', title: 'Muscle Building', cal: tdee + 500, desc: 'Higher calories to support muscle growth and recovery.' },
    { id: 'custom', title: 'Set My Own', cal: setupCalories, desc: 'Enter your own daily calorie target.' },
  ] : [];

  const canProceedBody = ageNum > 0 && heightNum > 0 && weightNum > 0;

  // ── Render: Setup Step 1 - Body Info ────────────────────────────────────
  if (needsSetup && setupStep === 'body') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <Text variant="headline" style={{ flex: 1 }}>Your Body Info</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: shortViewport ? spacing.sm : spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.color.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Ionicons name="nutrition" size={32} color={theme.color.success} />
            </View>
            <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>Welcome to Fuel Your Recovery</Text>
            <Text variant="footnote" dim center style={{ lineHeight: 20 }}>
              Tell us a bit about yourself so we can suggest the right nutrition plan for your recovery.
            </Text>
          </View>

          {/* Gender */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Gender</Text>
            <Text variant="caption" dim>Optional - improves accuracy</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {([null, 'male', 'female'] as const).map((g) => (
              <Pressable key={g ?? 'skip'} onPress={() => setGender(g)}
                style={({ pressed }) => ({
                  flex: 1, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: gender === g ? theme.color.primary : theme.color.surface,
                  borderWidth: 1, borderColor: gender === g ? theme.color.primary : theme.color.hairline,
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Text variant="callout" color={gender === g ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                  {g === null ? 'Skip' : g === 'male' ? 'Male' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Age */}
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Age</Text>
          <TextInput value={age} onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9]/g, '').slice(0, 3);
            const num = parseInt(cleaned) || 0;
            if (num <= 100) setAge(cleaned);
          }} keyboardType="numeric" placeholder="25" placeholderTextColor={theme.color.textDim}
            style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, color: theme.color.text, fontSize: 16, marginBottom: spacing.lg }} />

          {/* Height */}
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Height (cm)</Text>
          <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" placeholder="170" placeholderTextColor={theme.color.textDim}
            style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, color: theme.color.text, fontSize: 16, marginBottom: spacing.lg }} />

          {/* Weight */}
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Weight (kg)</Text>
          <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder="70" placeholderTextColor={theme.color.textDim}
            style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, color: theme.color.text, fontSize: 16, marginBottom: spacing.lg }} />

          {/* BMI display */}
          {bmi > 0 && (
            <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.lg, alignItems: 'center' }}>
              <Text variant="caption" dim>Your BMI</Text>
              <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold', color: bmi < 18.5 || bmi >= 25 ? theme.color.danger : theme.color.success }}>
                {bmi.toFixed(1)}
              </Text>
              <Text variant="caption" color={bmi < 18.5 || bmi >= 25 ? theme.color.danger : theme.color.success}>{bmiCategory}</Text>
            </View>
          )}

          <Text variant="caption" dim center style={{ marginBottom: spacing.lg, lineHeight: 18, fontStyle: 'italic' }}>
            This information is used only to calculate your nutrition plan. It is not medical advice.
          </Text>

          <Button label="Next: Activity Level" onPress={() => {
            if (!canProceedBody) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              return;
            }
            setSetupStep('activity');
          }} full />
          {!canProceedBody && (
            <Text variant="caption" color={theme.color.danger} center style={{ marginTop: spacing.sm }}>
              Please enter your age, height, and weight to continue
            </Text>
          )}
          <Button label="Skip for Now" kind="tertiary" onPress={finishSetup} full style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </Screen>
    );
  }

  // ── Render: Setup Step 2 - Activity Level ───────────────────────────────
  if (needsSetup && setupStep === 'activity') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable onPress={() => setSetupStep('body')} hitSlop={12} accessibilityRole="button"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <Text variant="headline" style={{ flex: 1 }}>Activity Level</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: shortViewport ? spacing.sm : spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Text variant="footnote" dim style={{ marginBottom: spacing.lg }}>
            How active are you on a typical week? This helps us calculate your daily calorie needs.
          </Text>

          <View style={{ gap: spacing.sm }}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <Pressable key={opt.id} onPress={() => setActivityLevel(opt.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  backgroundColor: activityLevel === opt.id ? theme.color.primarySoft : theme.color.surface,
                  borderRadius: radius.card, borderWidth: 1,
                  borderColor: activityLevel === opt.id ? theme.color.primary : theme.color.hairline,
                  padding: spacing.md, opacity: pressed ? 0.85 : 1,
                })}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                  borderColor: activityLevel === opt.id ? theme.color.primary : theme.color.hairline,
                  backgroundColor: activityLevel === opt.id ? theme.color.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {activityLevel === opt.id && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{opt.label}</Text>
                  <Text variant="caption" dim style={{ marginTop: 2 }}>{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {tdee > 0 && (
            <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginTop: spacing.lg, alignItems: 'center' }}>
              <Text variant="caption" dim>Your estimated daily calorie needs</Text>
              <Text variant="headline" color={theme.color.primary} style={{ fontFamily: 'Nunito_900Black' }}>{tdee} cal/day</Text>
            </View>
          )}

          <Button label="Next: Choose Plan" onPress={() => {
            if (!activityLevel) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              return;
            }
            setSetupStep('plan');
          }} full style={{ marginTop: spacing.lg }} />
          <Button label="Back" kind="tertiary" onPress={() => setSetupStep('body')} full style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </Screen>
    );
  }

  // ── Render: Setup Step 3 - Calorie Plan ─────────────────────────────────
  if (needsSetup && setupStep === 'plan') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable onPress={() => setSetupStep('activity')} hitSlop={12} accessibilityRole="button"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <Text variant="headline" style={{ flex: 1 }}>Choose Your Plan</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: shortViewport ? spacing.sm : spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Text variant="footnote" dim style={{ marginBottom: spacing.lg }}>
            Based on your body info, here are recommended nutrition plans. Choose what fits your recovery goals.
          </Text>

          <View style={{ gap: spacing.sm }}>
            {CALORIE_PLANS.map((plan) => (
              <Pressable key={plan.id} onPress={() => { setSelectedPlan(plan.id); setSetupCalories(plan.cal); }}
                style={({ pressed }) => ({
                  backgroundColor: theme.color.surface, borderRadius: radius.card,
                  borderWidth: 1, borderColor: selectedPlan === plan.id ? theme.color.primary : theme.color.hairline,
                  padding: spacing.md, opacity: pressed ? 0.85 : 1,
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{plan.title}</Text>
                  <View style={{
                    backgroundColor: theme.color.primarySoft, borderRadius: radius.round,
                    paddingHorizontal: spacing.sm, paddingVertical: 2,
                  }}>
                    <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>{plan.cal} cal/day</Text>
                  </View>
                </View>
                <Text variant="caption" dim style={{ lineHeight: 18 }}>{plan.desc}</Text>
              </Pressable>
            ))}
          </View>

          <Button label="Next: Confirm Goals" onPress={() => {
            if (!selectedPlan) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              return;
            }
            setSetupStep('goals');
          }} full style={{ marginTop: spacing.lg }} />
          <Button label="Back" kind="tertiary" onPress={() => setSetupStep('activity')} full style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </Screen>
    );
  }

  // ── Render: Goals confirmation ──────────────────────────────────────────
  if (needsSetup && setupStep === 'goals') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable onPress={() => setSetupStep('plan')} hitSlop={12} accessibilityRole="button"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <Text variant="headline" style={{ flex: 1 }}>Set Your Goals</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: shortViewport ? spacing.sm : spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Text variant="footnote" dim style={{ marginBottom: spacing.lg }}>Adjust your daily targets. These are personal goals, not restrictions.</Text>

          {/* Calorie goal */}
          <View style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Daily Calories</Text>
              <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{setupCalories}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
              <Pressable onPress={() => setSetupCalories(Math.max(1000, setupCalories - 50))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={20} color={theme.color.primary} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>{setupCalories}</Text>
                <Text variant="caption" dim>calories / day</Text>
              </View>
              <Pressable onPress={() => setSetupCalories(Math.min(5000, setupCalories + 50))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={20} color={theme.color.primary} />
              </Pressable>
            </View>
            {selectedPlan && (
              <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                {CALORIE_PLANS.find((p) => p.id === selectedPlan)?.title} plan selected
              </Text>
            )}
          </View>

          {/* Water goal */}
          <View style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Daily Water</Text>
              <Text variant="callout" color="#4A6FA5" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{fmtAmount(setupWater)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
              <Pressable onPress={() => setSetupWater(Math.max(500, setupWater - 250))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={20} color="#4A6FA5" />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>{fmtAmount(setupWater)}</Text>
                <Text variant="caption" dim>water / day</Text>
              </View>
              <Pressable onPress={() => setSetupWater(Math.min(5000, setupWater + 250))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={20} color="#4A6FA5" />
              </Pressable>
            </View>
          </View>

          <Button label="Start Tracking" onPress={finishSetup} full />
          <Button label="Skip for Now" kind="tertiary" onPress={finishSetup} full style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </Screen>
    );
  }

  // ── Render: Main dashboard ──────────────────────────────────────────────
  const todayMeals = foodEntries.filter((e) => {
    const d = new Date(e.at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });

  const mealIcons: Record<MealCategory, { icon: string; color: string }> = {
    breakfast: { icon: 'sunny', color: '#F9A825' },
    lunch: { icon: 'restaurant', color: theme.color.success },
    dinner: { icon: 'moon', color: theme.color.primary },
    snack: { icon: 'cafe', color: theme.color.textDim },
  };

  const mealHistory = [...foodEntries].sort((a, b) => b.at - a.at);

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, marginBottom: spacing.md }}>
        <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button"
          style={({ pressed }) => ({ width: 40, height: 40, flexShrink: 0, borderRadius: 20, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1, marginRight: spacing.sm })}>
          <Ionicons name="chevron-back" size={20} color={theme.color.primary} />
        </Pressable>
        <Text
          variant="title2"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.9}
          style={{ flex: 1, lineHeight: 40, fontFamily: 'Nunito_900Black', marginRight: spacing.xs }}
        >
          Fuel Your Recovery
        </Text>
        <Pressable onPress={() => setShowGoalsModal(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fuel settings"
          style={({ pressed }) => ({ width: 40, height: 40, flexShrink: 0, borderRadius: 20, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="settings-outline" size={22} color={theme.color.textDim} />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.md }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text variant="headline" style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold' }}>Today</Text>
        <Text variant="caption" dim>{todayMeals.length} meals logged</Text>
      </View>

      {/* ── Calorie summary ───────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: compact ? spacing.sm : spacing.lg,
        backgroundColor: theme.color.surface, borderRadius: radius.card,
        borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg,
        minHeight: compact ? 104 : 116, marginBottom: spacing.md,
      }}>
        <ProgressRing progress={calPct} size={compact ? 64 : 72} label="" value={`${today.food.calories}`} color={calorieRingColor} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="callout" color={calorieRingColor} style={{ fontFamily: 'Nunito_700Bold' }}>
            {calorieGoalExceeded
              ? `${caloriesExceeded} cal over goal`
              : calorieGoalReached
                ? 'Daily goal reached'
                : `${calRemaining} cal remaining`}
          </Text>
          <Text variant="caption" dim>of {goals.dailyCalories} cal goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2, marginTop: spacing.xs }}>
            <Text variant="caption" color={theme.color.success}>{today.food.protein}g protein</Text>
            <Text variant="caption" color="#4A6FA5">{fmtAmount(today.water)} water</Text>
          </View>
        </View>
      </View>

      {/* ── Water + Fasting (side by side) ──────────────────────────────── */}
      <View style={{ flexDirection: stackTrackers ? 'column' : 'row', gap: spacing.md, marginBottom: spacing.md }}>
        {/* Water tracker */}
        <View style={{
          flex: stackTrackers ? undefined : 1, width: stackTrackers ? '100%' : undefined,
          backgroundColor: theme.color.surface, borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg,
          minHeight: stackTrackers ? 132 : shortViewport ? 138 : 154,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <Ionicons name="water" size={14} color="#4A6FA5" />
            <Text variant="caption" color="#4A6FA5" style={{ fontFamily: 'Nunito_700Bold' }}>Water</Text>
          </View>
          <Text variant="callout" color="#4A6FA5" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>
            {fmtAmount(today.water)}
          </Text>
          <Text variant="caption" dim style={{ marginBottom: spacing.sm }}>of {fmtAmount(goals.dailyWaterMl)}</Text>
          {/* Progress */}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceAlt, overflow: 'hidden', marginBottom: spacing.sm }}>
            <View style={{ height: '100%', borderRadius: 3, backgroundColor: '#4A6FA5', width: `${Math.min(100, waterPct * 100)}%` }} />
          </View>
          {/* Quick add */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {WATER_PRESETS.slice(0, 3).map((ml) => (
              <Pressable key={ml} onPress={() => quickAddWater(ml)}
                style={({ pressed }) => ({
                  flex: 1, height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: theme.color.primarySoft,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', fontSize: 10 }}>+{ml}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fasting tracker */}
        <View style={{
          flex: stackTrackers ? undefined : 1, width: stackTrackers ? '100%' : undefined,
          backgroundColor: theme.color.surface, borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg,
          minHeight: stackTrackers ? 132 : shortViewport ? 138 : 154,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <Ionicons name="timer" size={14} color={activeFast ? theme.color.success : theme.color.textDim} />
            <Text variant="caption" color={activeFast ? theme.color.success : theme.color.textDim} style={{ fontFamily: 'Nunito_700Bold' }}>Fasting</Text>
          </View>

          {activeFast ? (
            /* Active fast - countdown */
            <>
              <Text variant="callout" color={theme.color.success} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                {formatFastDuration(Date.now() - activeFast.startedAt)}
              </Text>
              <Text variant="caption" dim style={{ marginBottom: spacing.sm }}>elapsed</Text>
              <Pressable onPress={toggleFast}
                style={({ pressed }) => ({ height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.danger, opacity: pressed ? 0.8 : 1 })}>
                <Text variant="caption" color="#FFFFFF" style={{ fontFamily: 'Nunito_700Bold' }}>End Fast</Text>
              </Pressable>
            </>
          ) : (
            /* No active fast - dropdown + start */
            <>
              {/* Dropdown */}
              <Pressable onPress={() => setShowFastModal(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
                  borderWidth: 1, borderColor: theme.color.hairline,
                  paddingHorizontal: spacing.sm, height: 36, marginBottom: spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Text variant="caption" color={fastingGoal ? theme.color.text : theme.color.textDim} style={{ fontFamily: fastingGoal ? 'Nunito_700Bold' : undefined }}>
                  {fastingGoal?.schedule === 'custom'
                    ? formatFastDuration(selectedFastMinutes * 60_000)
                    : fastingGoal ? FASTING_SCHEDULES[fastingGoal.schedule]?.label ?? 'Select' : 'Select schedule'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={theme.color.textDim} />
              </Pressable>
              {/* Start button */}
              <Pressable onPress={() => {
                if (canStartSelectedFast) {
                  startFuelFast(selectedFastMinutes);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                }
              }}
                style={({ pressed }) => ({
                  height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: canStartSelectedFast ? theme.color.success : theme.color.surfaceAlt,
                  opacity: pressed ? 0.8 : canStartSelectedFast ? 1 : 0.5,
                })}>
                <Text variant="caption" color={canStartSelectedFast ? '#FFFFFF' : theme.color.textDim} style={{ fontFamily: 'Nunito_700Bold' }}>
                  {canStartSelectedFast ? 'Start' : 'Pick first'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ── Today's tip ───────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: theme.color.primarySoft, borderRadius: radius.card,
        padding: spacing.lg, minHeight: 84, marginBottom: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Ionicons name="bulb" size={14} color={theme.color.primary} />
          <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>Tip</Text>
        </View>
        <Text variant="caption" style={{ lineHeight: 19 }}>{todaysTip()}</Text>
      </View>

      <View style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold' }}>7-day calorie trend</Text>
            <Text variant="caption" dim style={{ marginTop: 2 }}>Every day stays on your record</Text>
          </View>
          <Ionicons name="stats-chart-outline" size={20} color={theme.color.primary} />
        </View>
        <View style={{ height: shortViewport ? 104 : 132, flexDirection: 'row', alignItems: 'flex-end', gap: compact ? 5 : spacing.sm }}>
          {calorieHistory.map((day) => {
            const color = day.status === 'over'
              ? theme.color.danger
              : day.status === 'reached'
                ? theme.color.success
                : day.status === 'under'
                  ? theme.color.celebrateText
                  : theme.color.hairline;
            const barHeight = day.calories === 0
              ? 5
              : Math.max(12, Math.round((day.calories / calorieChartMax) * 92));
            return (
              <View key={day.date} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Text variant="caption" dim style={{ fontSize: 9, marginBottom: 3 }}>
                  {day.calories > 0 ? day.calories : '—'}
                </Text>
                <View
                  accessibilityLabel={`${day.label}: ${day.calories} calories, ${day.status}`}
                  style={{ width: '68%', minWidth: 12, height: barHeight, borderRadius: radius.round, backgroundColor: color }}
                />
                <Text variant="caption" dim style={{ marginTop: spacing.xs }}>{day.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }}>
          <ChartLegend color={theme.color.celebrateText} label="Under" />
          <ChartLegend color={theme.color.success} label="Reached" />
          <ChartLegend color={theme.color.danger} label="Over" />
          <ChartLegend color={theme.color.hairline} label="No entries" />
        </View>
      </View>

      {/* Keep the dashboard focused; detailed logs live in History. */}
      <Pressable
        onPress={() => setShowHistoryModal(true)}
        accessibilityRole="button"
        accessibilityLabel="Show meal history"
        style={({ pressed }) => ({
          minHeight: 68,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          marginBottom: spacing.md,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          backgroundColor: theme.color.surface,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.primarySoft }}>
          <Ionicons name="time-outline" size={20} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>Meal history</Text>
          <Text variant="caption" dim>{todayMeals.length} logged today · {foodEntries.length} total</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.color.textDim} />
      </Pressable>
      <Button
        label="Log a meal"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          setShowFoodModal(true);
        }}
        full
      />
      </ScrollView>

      {/* ── Meal history modal ─────────────────────────────────────────── */}
      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowHistoryModal(false)} />
          <View style={{
            backgroundColor: theme.color.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingBottom: 40,
            maxHeight: Math.min(viewportHeight * (isLandscape ? 0.82 : 0.65), 520),
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.lg }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold' }}>Meal history</Text>
                <Text variant="caption" dim style={{ marginTop: 2 }}>{foodEntries.length} total entries</Text>
              </View>
              <Pressable
                onPress={() => setShowHistoryModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close meal history"
                hitSlop={10}
                style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surfaceAlt, opacity: pressed ? 0.65 : 1 })}
              >
                <Ionicons name="close" size={20} color={theme.color.text} />
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: Math.min(viewportHeight * (isLandscape ? 0.56 : 0.44), 360) }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              {mealHistory.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
                  <Ionicons name="restaurant-outline" size={32} color={theme.color.textDim} />
                  <Text variant="footnote" dim center style={{ marginTop: spacing.md }}>No meals logged yet</Text>
                </View>
              ) : mealHistory.map((entry) => {
                const meal = mealIcons[entry.category];
                return (
                  <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.hairline }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surfaceAlt }}>
                      <Ionicons name={meal.icon as any} size={18} color={meal.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{entry.name}</Text>
                      <Text variant="caption" dim style={{ marginTop: 2 }}>
                        {new Date(entry.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · {fmtTime(entry.at)} · {entry.category}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{entry.calories}</Text>
                      <Text variant="caption" dim>cal</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Food logging modal ──────────────────────────────────────────── */}
      <Modal visible={showFoodModal} transparent animationType="slide" onRequestClose={() => setShowFoodModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowFoodModal(false)} />
          <View style={{
            backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            padding: shortViewport ? spacing.lg : spacing.xl,
            paddingBottom: shortViewport ? spacing.lg : 40,
            maxHeight: sheetMaxHeight,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.lg }} />
            <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.lg }}>Log Meal</Text>

            {/* Meal category */}
            <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: compact ? 'wrap' : 'nowrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealCategory[]).map((cat) => (
                <Pressable key={cat} onPress={() => setFoodCategory(cat)}
                  style={({ pressed }) => ({
                    flexGrow: 1, flexBasis: compact ? '46%' : 0, height: 40, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: foodCategory === cat ? theme.color.primary : theme.color.surfaceAlt,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text variant="caption" color={foodCategory === cat ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold', textTransform: 'capitalize' }}>{cat}</Text>
                </Pressable>
              ))}
            </View>

            {/* Food name */}
            <TextInput value={foodName} onChangeText={setFoodName} placeholder="Food name" placeholderTextColor={theme.color.textDim}
              style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, color: theme.color.text, fontSize: 16, marginBottom: spacing.md }} />

            {/* Macros row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {[
                { label: 'Cal', value: foodCalories, set: setFoodCalories, color: theme.color.primary },
                { label: 'Protein', value: foodProtein, set: setFoodProtein, color: theme.color.success },
                { label: 'Carbs', value: foodCarbs, set: setFoodCarbs, color: theme.color.primary },
                { label: 'Fat', value: foodFat, set: setFoodFat, color: theme.color.accentText },
                { label: 'Fiber', value: foodFiber, set: setFoodFiber, color: theme.color.celebrateText },
              ].map((f) => (
                <View key={f.label} style={{ flexGrow: 1, flexBasis: compact ? '29%' : 0, minWidth: 54 }}>
                  <Text variant="caption" dim style={{ marginBottom: 2 }}>{f.label}</Text>
                  <TextInput value={f.value} onChangeText={f.set} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.color.textDim}
                    style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, color: theme.color.text, fontSize: 14, textAlign: 'center' }} />
                </View>
              ))}
            </View>

            <Button label="Save Meal" onPress={submitFood} disabled={!foodName.trim()} full />
            <Button label="Cancel" kind="tertiary" onPress={() => setShowFoodModal(false)} full style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </Modal>

      {/* ── Water modal ─────────────────────────────────────────────────── */}
      <Modal visible={showWaterModal} transparent animationType="slide" onRequestClose={() => setShowWaterModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowWaterModal(false)} />
          <View style={{
            backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            padding: spacing.xl, paddingBottom: 40,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.lg }} />
            <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>Add Water</Text>
            <Text variant="caption" dim style={{ marginBottom: spacing.lg }}>Today: {fmtAmount(today.water)} / {fmtAmount(goals.dailyWaterMl)}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {WATER_PRESETS.map((ml) => (
                <Pressable key={ml} onPress={() => { quickAddWater(ml); setShowWaterModal(false); }}
                  style={({ pressed }) => ({
                    flex: 1, height: 56, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: theme.color.primarySoft, borderWidth: 1, borderColor: theme.color.primary + '30',
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Ionicons name="water" size={20} color={theme.color.primary} />
                  <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', marginTop: 4 }}>{ml}mL</Text>
                </Pressable>
              ))}
            </View>
            <Button label="Close" kind="tertiary" onPress={() => setShowWaterModal(false)} full style={{ marginTop: spacing.lg }} />
          </View>
        </View>
      </Modal>

      {/* ── Fasting modal ───────────────────────────────────────────────── */}
      <Modal visible={showFastModal} transparent animationType="slide" onRequestClose={() => setShowFastModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowFastModal(false)} />
          <View style={{
            backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            maxHeight: sheetMaxHeight, paddingBottom: shortViewport ? spacing.lg : 40,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl }}>
            <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>Fasting Tracker</Text>
            <Text variant="caption" dim style={{ marginBottom: spacing.lg }}>Optional - choose a schedule that supports your recovery.</Text>

            {!activeFast ? (
              <>
                {/* Schedule selection */}
                <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Choose a schedule</Text>
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  {Object.entries(FASTING_SCHEDULES).map(([key, sched]) => (
                    <Pressable key={key} onPress={() => {
                      setFastingGoal({
                        schedule: key as any,
                        startEatingHour: fastingGoal?.startEatingHour ?? 12,
                        startEatingMinute: fastingGoal?.startEatingMinute ?? 0,
                        customMinutes: key === 'custom'
                          ? (Number(customFastHours) || 0) * 60 + (Number(customFastMinutes) || 0)
                          : undefined,
                      });
                      Haptics.selectionAsync().catch(() => {});
                    }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                        padding: spacing.md, borderRadius: radius.card,
                        backgroundColor: fastingGoal?.schedule === key ? theme.color.primarySoft : theme.color.surfaceAlt,
                        borderWidth: 1, borderColor: fastingGoal?.schedule === key ? theme.color.primary : theme.color.hairline,
                        opacity: pressed ? 0.85 : 1,
                      })}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                        borderColor: fastingGoal?.schedule === key ? theme.color.primary : theme.color.hairline,
                        backgroundColor: fastingGoal?.schedule === key ? theme.color.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {fastingGoal?.schedule === key && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{sched.label}</Text>
                        <Text variant="caption" dim>{sched.description}</Text>
                      </View>
                      <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                        {key === 'custom' ? 'Set time' : `${sched.hours}h`}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {fastingGoal?.schedule === 'custom' && (
                  <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.lg }}>
                    <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Custom duration</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Hours</Text>
                        <TextInput
                          value={customFastHours}
                          onChangeText={(value) => {
                            const cleaned = value.replace(/\D/g, '').slice(0, 2);
                            setCustomFastHours(cleaned);
                            const total = (Number(cleaned) || 0) * 60 + (Number(customFastMinutes) || 0);
                            setFastingGoal({ ...fastingGoal, customMinutes: total });
                          }}
                          keyboardType="number-pad"
                          placeholder="12"
                          placeholderTextColor={theme.color.textDim}
                          accessibilityLabel="Custom fasting hours"
                          style={{ height: 48, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, backgroundColor: theme.color.surface, paddingHorizontal: spacing.md, color: theme.color.text, fontSize: 16 }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Minutes</Text>
                        <TextInput
                          value={customFastMinutes}
                          onChangeText={(value) => {
                            const cleaned = value.replace(/\D/g, '').slice(0, 2);
                            const minutes = Math.min(59, Number(cleaned) || 0);
                            setCustomFastMinutes(cleaned === '' ? '' : String(minutes));
                            const total = (Number(customFastHours) || 0) * 60 + minutes;
                            setFastingGoal({ ...fastingGoal, customMinutes: total });
                          }}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={theme.color.textDim}
                          accessibilityLabel="Custom fasting minutes"
                          style={{ height: 48, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, backgroundColor: theme.color.surface, paddingHorizontal: spacing.md, color: theme.color.text, fontSize: 16 }}
                        />
                      </View>
                    </View>
                    <Text variant="caption" color={canStartSelectedFast ? theme.color.success : theme.color.danger} style={{ marginTop: spacing.sm }}>
                      {canStartSelectedFast
                        ? `Fast duration: ${formatFastDuration(selectedFastMinutes * 60_000)}`
                        : 'Choose a duration between 1 minute and 24 hours.'}
                    </Text>
                  </View>
                )}

                {/* Start eating time */}
                {fastingGoal && (
                  <>
                    <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>When do you start eating?</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, flexWrap: 'wrap' }}>
                      {[6, 8, 10, 12, 14, 16, 18].map((h) => (
                        <Pressable key={h} onPress={() => {
                          setShowCustomEatingTime(false);
                          setFastingGoal({ ...fastingGoal, startEatingHour: h, startEatingMinute: 0 });
                          Haptics.selectionAsync().catch(() => {});
                        }}
                          style={({ pressed }) => ({
                            paddingHorizontal: spacing.md, height: 36, borderRadius: radius.round,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: fastingGoal.startEatingHour === h ? theme.color.primary : theme.color.surfaceAlt,
                            borderWidth: 1, borderColor: fastingGoal.startEatingHour === h ? theme.color.primary : theme.color.hairline,
                            opacity: pressed ? 0.8 : 1,
                          })}>
                          <Text variant="caption" color={fastingGoal.startEatingHour === h ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                            {h > 12 ? `${h - 12} PM` : `${h} AM`}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => {
                          setShowCustomEatingTime(true);
                          applyCustomEatingTime(customEatingHour, customEatingMinute, customEatingPeriod);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={({ pressed }) => ({
                          paddingHorizontal: spacing.md,
                          height: 36,
                          borderRadius: radius.round,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: showCustomEatingTime ? theme.color.primary : theme.color.surfaceAlt,
                          borderWidth: 1,
                          borderColor: showCustomEatingTime ? theme.color.primary : theme.color.hairline,
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <Text variant="caption" color={showCustomEatingTime ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                          Other time
                        </Text>
                      </Pressable>
                    </View>

                    {showCustomEatingTime && (
                      <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md }}>
                        <Text variant="caption" dim style={{ marginBottom: spacing.sm }}>Enter your start time</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <TextInput
                            value={customEatingHour}
                            onChangeText={(value) => {
                              const cleaned = value.replace(/\D/g, '').slice(0, 2);
                              const normalized = cleaned === '' ? '' : String(Math.min(12, Number(cleaned) || 0));
                              setCustomEatingHour(normalized);
                              applyCustomEatingTime(normalized, customEatingMinute, customEatingPeriod);
                            }}
                            keyboardType="number-pad"
                            placeholder="8"
                            placeholderTextColor={theme.color.textDim}
                            accessibilityLabel="Eating start hour"
                            style={{ flex: 1, height: 48, textAlign: 'center', borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, backgroundColor: theme.color.surface, color: theme.color.text, fontSize: 16 }}
                          />
                          <Text variant="headline">:</Text>
                          <TextInput
                            value={customEatingMinute}
                            onChangeText={(value) => {
                              const cleaned = value.replace(/\D/g, '').slice(0, 2);
                              const normalized = cleaned === '' ? '' : String(Math.min(59, Number(cleaned) || 0));
                              setCustomEatingMinute(normalized);
                              applyCustomEatingTime(customEatingHour, normalized, customEatingPeriod);
                            }}
                            keyboardType="number-pad"
                            placeholder="00"
                            placeholderTextColor={theme.color.textDim}
                            accessibilityLabel="Eating start minute"
                            style={{ flex: 1, height: 48, textAlign: 'center', borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, backgroundColor: theme.color.surface, color: theme.color.text, fontSize: 16 }}
                          />
                          {(['AM', 'PM'] as const).map((period) => (
                            <Pressable
                              key={period}
                              onPress={() => {
                                setCustomEatingPeriod(period);
                                applyCustomEatingTime(customEatingHour, customEatingMinute, period);
                              }}
                              style={({ pressed }) => ({
                                height: 48,
                                minWidth: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: radius.card,
                                backgroundColor: customEatingPeriod === period ? theme.color.primary : theme.color.surface,
                                opacity: pressed ? 0.75 : 1,
                              })}
                            >
                              <Text variant="caption" color={customEatingPeriod === period ? '#FFFFFF' : theme.color.text}>{period}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text variant="caption" color={theme.color.primary} style={{ marginTop: spacing.sm }}>
                          Starts at {fmtClock(fastingGoal.startEatingHour, fastingGoal.startEatingMinute)}
                        </Text>
                      </View>
                    )}

                    {/* Time window preview */}
                    <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.lg }}>
                      <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Your fasting window</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                        <View style={{ alignItems: 'center' }}>
                          <Ionicons name="sunny" size={18} color="#F9A825" />
                          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginTop: 4 }}>
                            {fmtClock(fastingGoal.startEatingHour, fastingGoal.startEatingMinute)}
                          </Text>
                          <Text variant="caption" dim>Start eating</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={theme.color.textDim} />
                        <View style={{ alignItems: 'center' }}>
                          <Ionicons name="moon" size={18} color={theme.color.primary} />
                          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginTop: 4 }}>
                            {(() => {
                              const hours = FASTING_SCHEDULES[fastingGoal.schedule]?.hours ?? 16;
                              const stopHour = fastingGoal.startEatingHour + 8;
                              const stopH = stopHour > 24 ? stopHour - 24 : stopHour;
                              return stopH > 12 ? `${stopH - 12} PM` : `${stopH} AM`;
                            })()}
                          </Text>
                          <Text variant="caption" dim>Stop eating</Text>
                        </View>
                      </View>
                      <Text variant="caption" dim center style={{ marginTop: spacing.sm }}>
                        {fastingGoal.schedule === 'custom'
                          ? `${formatFastDuration(selectedFastMinutes * 60_000)} fasting`
                          : `${FASTING_SCHEDULES[fastingGoal.schedule]?.hours ?? 16} hours fasting`}
                      </Text>
                    </View>
                  </>
                )}

                {/* Reminder info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                  <Ionicons name="notifications-outline" size={16} color={theme.color.primary} />
                  <Text variant="caption" dim style={{ flex: 1 }}>You'll be reminded when your fasting window starts and ends.</Text>
                </View>

                <Button label="Start Fast" onPress={() => {
                  if (canStartSelectedFast) {
                    startFuelFast(selectedFastMinutes);
                    updateFuelGoals({ fastingGoal });
                    setShowFastModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  }
                }} disabled={!canStartSelectedFast} full />
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: theme.color.successSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="timer" size={36} color={theme.color.success} />
                </View>
                <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold' }}>Fast in Progress</Text>
                <Text variant="caption" dim>Started at {fmtTime(activeFast.startedAt)}</Text>
                <Text variant="title1" color={theme.color.success} style={{ fontFamily: 'Nunito_900Black' }}>
                  {formatFastDuration(Date.now() - activeFast.startedAt)}
                </Text>
                <Text variant="caption" dim>elapsed of {activeFast.targetMinutes} min</Text>
                <Button label="End Fast" kind="secondary" onPress={() => { toggleFast(); setShowFastModal(false); }} full />
              </View>
            )}
            </ScrollView>
            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.sm }}>
              <Button label="Close" kind="tertiary" onPress={() => setShowFastModal(false)} full />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Settings modal (body info + goals) ──────────────────────────── */}
      <Modal visible={showGoalsModal} transparent animationType="slide" onRequestClose={() => setShowGoalsModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowGoalsModal(false)} />
          <View style={{
            backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            padding: shortViewport ? spacing.lg : spacing.xl,
            paddingBottom: shortViewport ? spacing.lg : 40,
            maxHeight: sheetMaxHeight,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.lg }} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>Settings</Text>
              <Text variant="caption" dim style={{ marginBottom: spacing.lg }}>Edit your body info and nutrition goals anytime.</Text>

              {/* ── Body Info Section ──────────────────────────────────────── */}
              <Text variant="footnote" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Body Information</Text>

              {/* Gender */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                {([null, 'male', 'female'] as const).map((g) => (
                  <Pressable key={g ?? 'skip'} onPress={() => {
                    const bmr = g === 'female'
                      ? 10 * (parseFloat(weightKg) || 70) + 6.25 * (parseFloat(heightCm) || 170) - 5 * (parseInt(age) || 25) - 161
                      : 10 * (parseFloat(weightKg) || 70) + 6.25 * (parseFloat(heightCm) || 170) - 5 * (parseInt(age) || 25) + 5;
                    setGender(g);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                    style={({ pressed }) => ({
                      flex: 1, height: 40, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: gender === g ? theme.color.primary : theme.color.surfaceAlt,
                      borderWidth: 1, borderColor: gender === g ? theme.color.primary : theme.color.hairline,
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <Text variant="caption" color={gender === g ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                      {g === null ? 'Skip' : g === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Age, Height, Weight row */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" dim style={{ marginBottom: 4 }}>Age</Text>
                  <TextInput value={age} onChangeText={(t) => {
                    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 3);
                    const num = parseInt(cleaned) || 0;
                    if (num <= 100) setAge(cleaned);
                  }} keyboardType="numeric"
                    style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, color: theme.color.text, fontSize: 14, textAlign: 'center' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" dim style={{ marginBottom: 4 }}>Height (cm)</Text>
                  <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"
                    style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, color: theme.color.text, fontSize: 14, textAlign: 'center' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" dim style={{ marginBottom: 4 }}>Weight (kg)</Text>
                  <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="numeric"
                    style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, color: theme.color.text, fontSize: 14, textAlign: 'center' }} />
                </View>
              </View>

              {/* BMI display */}
              {bmi > 0 && (
                <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                  <Text variant="caption" dim>BMI</Text>
                  <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', color: bmi < 18.5 || bmi >= 25 ? theme.color.danger : theme.color.success }}>
                    {bmi.toFixed(1)}
                  </Text>
                  <Text variant="caption" color={bmi < 18.5 || bmi >= 25 ? theme.color.danger : theme.color.success}>{bmiCategory}</Text>
                </View>
              )}

              {/* Activity level */}
              <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Activity Level</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg }}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <Pressable key={opt.id} onPress={() => { setActivityLevel(opt.id); Haptics.selectionAsync().catch(() => {}); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md, height: 32, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: activityLevel === opt.id ? theme.color.primary : theme.color.surfaceAlt,
                      borderWidth: 1, borderColor: activityLevel === opt.id ? theme.color.primary : theme.color.hairline,
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <Text variant="caption" color={activityLevel === opt.id ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* ── Calorie Goals Section ──────────────────────────────────── */}
              <Text variant="footnote" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>Nutrition Goals</Text>

              {/* Calories */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, marginBottom: spacing.sm }}>
                <Pressable onPress={() => updateFuelGoals({ dailyCalories: Math.max(1000, goals.dailyCalories - 50) })}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="remove" size={16} color={theme.color.primary} />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{goals.dailyCalories} cal</Text>
                </View>
                <Pressable onPress={() => updateFuelGoals({ dailyCalories: Math.min(5000, goals.dailyCalories + 50) })}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={16} color={theme.color.primary} />
                </Pressable>
              </View>

              {/* Water */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, marginBottom: spacing.md }}>
                <Pressable onPress={() => updateFuelGoals({ dailyWaterMl: Math.max(500, goals.dailyWaterMl - 250) })}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="remove" size={16} color="#4A6FA5" />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="callout" color="#4A6FA5" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{fmtAmount(goals.dailyWaterMl)} water</Text>
                </View>
                <Pressable onPress={() => updateFuelGoals({ dailyWaterMl: Math.min(5000, goals.dailyWaterMl + 250) })}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={16} color="#4A6FA5" />
                </Pressable>
              </View>

              {/* Quick presets */}
              <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Quick Presets</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
                {[
                  { label: 'Light (1500)', cal: 1500, water: 2000 },
                  { label: 'Balanced (2000)', cal: 2000, water: 2500 },
                  { label: 'Active (2500)', cal: 2500, water: 3000 },
                  { label: 'Muscle (3000)', cal: 3000, water: 3500 },
                ].map((preset) => (
                  <Pressable key={preset.label} onPress={() => {
                    updateFuelGoals({ dailyCalories: preset.cal, dailyWaterMl: preset.water });
                    Haptics.selectionAsync().catch(() => {});
                  }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md, height: 32, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: goals.dailyCalories === preset.cal ? theme.color.primary : theme.color.surfaceAlt,
                      borderWidth: 1, borderColor: goals.dailyCalories === preset.cal ? theme.color.primary : theme.color.hairline,
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <Text variant="caption" color={goals.dailyCalories === preset.cal ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Save button */}
              <Button label="Save Changes" onPress={() => {
                setFuelBodyInfo({ dailyCalories: goals.dailyCalories, dailyWaterMl: goals.dailyWaterMl });
                setShowGoalsModal(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }} full />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
