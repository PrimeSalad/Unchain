import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from './Screen';
import { Text } from './Text';
import { Card } from './Card';
import { Button } from './Button';
import { Pill } from './Pill';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, spacing } from '../theme/tokens';
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  addictionMeta,
  formatMoneyInput,
  parseMoneyInput,
  triggersForAddiction,
  type AddictionType,
  type ExpensePeriod,
} from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';
import {
  GOAL_MODES,
  finalizeRecoveryTrackDraft,
  localMidnightDaysAgo,
  recoverySetupStepsForTracks,
  validateRecoveryTrackDraft,
  type GoalMode,
  type RecoveryTrackDraft,
  type RecoveryTrackSetup,
  type RecoveryTrackSetupMap,
  type RecoveryTrackSetupStep,
} from '@/domain/recoveryTrackSetup';

const PERIODS: ExpensePeriod[] = ['daily', 'weekly', 'monthly'];

export type RecoveryTrackDraftMap = Partial<Record<AddictionType, RecoveryTrackDraft>>;

interface RecoveryTrackSetupFlowProps {
  trackOrder: AddictionType[];
  drafts: RecoveryTrackDraftMap;
  onDraftChange: (type: AddictionType, draft: RecoveryTrackDraft) => void;
  onComplete: (tracks: RecoveryTrackSetupMap) => boolean | void;
  onBackFromFirst: () => void;
  onCancel?: () => void;
  finalLabel?: string;
}

function calendarDaysAgo(timestamp: number, now = Date.now()): number {
  const then = new Date(timestamp);
  const today = new Date(now);
  const thenOrdinal = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const todayOrdinal = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((todayOrdinal - thenOrdinal) / 86_400_000));
}

const goalLabels: Record<GoalMode, { title: string; detail: string }> = {
  quit: { title: 'Quit', detail: 'Stop this habit completely' },
  reduce: { title: 'Reduce', detail: 'Cut back with intention' },
  take_a_break: { title: 'Take a break', detail: 'Pause for a period of time' },
};

/** Shared, controlled setup wizard used by onboarding and Profile Add/Review. */
export function RecoveryTrackSetupFlow({
  trackOrder,
  drafts,
  onDraftChange,
  onComplete,
  onBackFromFirst,
  onCancel,
  finalLabel = 'Finish setup',
}: RecoveryTrackSetupFlowProps) {
  const theme = useTheme();
  const steps = useMemo(
    () => recoverySetupStepsForTracks(trackOrder),
    [trackOrder],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  const safeIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const step = steps[safeIndex];
  if (!step) return null;
  const draft = drafts[step.addictionType];
  if (!draft) return null;
  const meta = addictionMeta(step.addictionType);
  const trackPosition = trackOrder.indexOf(step.addictionType) + 1;
  const reasonSuggestion = trackOrder
    .filter((type) => type !== step.addictionType)
    .map((type) => ({ label: addictionMeta(type).label, reason: drafts[type]?.reason.trim() ?? '' }))
    .find((item) => item.reason.length > 0 && item.reason !== draft.reason.trim());

  const patchDraft = (patch: Partial<RecoveryTrackDraft>) => {
    setError(null);
    onDraftChange(step.addictionType, { ...draft, ...patch });
  };

  const back = () => {
    setError(null);
    if (safeIndex === 0) onBackFromFirst();
    else setStepIndex(safeIndex - 1);
  };

  const firstIssueForStep = () => validateRecoveryTrackDraft(draft)
    .find((issue) => issue.stepId === step.id);

  const next = () => {
    const issue = firstIssueForStep();
    if (issue) {
      setError(issue.message);
      AccessibilityInfo.announceForAccessibility(issue.message);
      return;
    }
    setError(null);
    if (safeIndex < steps.length - 1) {
      setStepIndex(safeIndex + 1);
      return;
    }

    if (submissionLock.current) return;
    submissionLock.current = true;
    const completedAt = Date.now();
    const setups: RecoveryTrackSetupMap = {};
    for (const type of trackOrder) {
      const candidate = drafts[type];
      if (!candidate) {
        submissionLock.current = false;
        return;
      }
      const result = finalizeRecoveryTrackDraft(candidate, completedAt);
      if (!result.ok) {
        const first = result.issues[0];
        const target = steps.findIndex((item) => item.id === first.stepId);
        if (target >= 0) setStepIndex(target);
        setError(first.message);
        AccessibilityInfo.announceForAccessibility(first.message);
        submissionLock.current = false;
        return;
      }
      setups[type] = result.value;
    }
    setSubmitting(true);
    try {
      const accepted = onComplete(setups);
      if (accepted === false) {
        submissionLock.current = false;
        setSubmitting(false);
      }
    } catch {
      submissionLock.current = false;
      setSubmitting(false);
      setError('The recovery track could not be saved. Please try again.');
    }
  };

  const inputStyle = {
    minHeight: 52,
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: error ? theme.color.danger : theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 17,
  } as const;

  const continueLabel = safeIndex === steps.length - 1 ? finalLabel : 'Continue';

  return (
    <Screen edges={['top', 'bottom']} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl }}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.round,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.color.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
        </Pressable>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <ProgressBar
            progress={(safeIndex + 1) / steps.length}
            height={8}
            accessibilityLabel={`Setup step ${safeIndex + 1} of ${steps.length}`}
          />
          <Text variant="caption" dim numberOfLines={1}>
            Track {trackPosition} of {trackOrder.length} · {meta.label}
          </Text>
        </View>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel recovery track setup"
            style={({ pressed }) => ({
              minWidth: 56,
              minHeight: 44,
              alignItems: 'flex-end',
              justifyContent: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text variant="callout" color={theme.color.primary}>Cancel</Text>
          </Pressable>
        ) : (
          <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
            {safeIndex + 1}/{steps.length}
          </Text>
        )}
      </View>

      <TrackStep
        step={step}
        draft={draft}
        patchDraft={patchDraft}
        inputStyle={inputStyle}
        reasonSuggestion={reasonSuggestion}
      />

      {error ? (
        <View
          accessibilityRole="alert"
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.input,
            backgroundColor: `${theme.color.danger}18`,
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Ionicons name="alert-circle" size={18} color={theme.color.danger} />
          <Text variant="footnote" color={theme.color.danger} style={{ flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={submitting ? 'Saving…' : continueLabel}
        onPress={next}
        disabled={submitting}
        full
        style={{ marginTop: spacing.xl, marginBottom: spacing.md }}
      />
    </Screen>
  );
}

interface TrackStepProps {
  step: RecoveryTrackSetupStep;
  draft: RecoveryTrackDraft;
  patchDraft: (patch: Partial<RecoveryTrackDraft>) => void;
  inputStyle: object;
  reasonSuggestion?: { label: string; reason: string };
}

function TrackStep({ step, draft, patchDraft, inputStyle, reasonSuggestion }: TrackStepProps) {
  const theme = useTheme();
  const meta = addictionMeta(step.addictionType);
  const daysAgo = calendarDaysAgo(draft.startedAtLocalMidnight);
  const triggerOptions = step.addictionType === 'pornography'
    ? PORN_TRIGGERS
    : triggersForAddiction(step.addictionType);
  const toggleTrigger = (trigger: string) => patchDraft({
    triggers: draft.triggers.includes(trigger)
      ? draft.triggers.filter((item) => item !== trigger)
      : [...draft.triggers, trigger],
  });

  if (step.key === 'detail') {
    return (
      <View>
        <Text variant="title1">{meta.specificQuestion}</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          {step.required ? 'This personalizes this recovery track.' : 'Optional — add context if it helps you.'}
        </Text>
        {meta.specificOptions ? (
          <Card padding={0}>
            {meta.specificOptions.map((option, index) => {
              const selected = draft.addictionDetail === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => patchDraft({ addictionDetail: option })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    padding: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.color.hairline,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="callout" style={{ flex: 1 }} color={selected ? theme.color.primary : theme.color.text}>
                    {option}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={20} color={theme.color.primary} /> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <View>
            <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Your answer</Text>
            <TextInput
              value={draft.addictionDetail ?? ''}
              onChangeText={(addictionDetail) => patchDraft({ addictionDetail })}
              placeholder={step.addictionType === 'other' ? 'Describe the habit' : 'Add an optional note'}
              placeholderTextColor={theme.color.textDim}
              accessibilityLabel="Category details"
              multiline
              style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
            />
          </View>
        )}
      </View>
    );
  }

  if (step.key === 'goal_mode') {
    return (
      <View>
        <Text variant="title1">What’s your goal for {meta.label.toLowerCase()}?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          You can choose the approach that feels realistic today.
        </Text>
        <Card padding={0}>
          {GOAL_MODES.map((mode, index) => {
            const selected = draft.goalMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => patchDraft({ goalMode: mode })}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => ({
                  minHeight: 68,
                  padding: spacing.lg,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.color.hairline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="callout" color={selected ? theme.color.primary : theme.color.text}>
                    {goalLabels[mode].title}
                  </Text>
                  <Text variant="caption" dim style={{ marginTop: 2 }}>{goalLabels[mode].detail}</Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? theme.color.primary : theme.color.textDim}
                />
              </Pressable>
            );
          })}
        </Card>
      </View>
    );
  }

  if (step.key === 'started_at') {
    return (
      <View>
        <Text variant="title1">When did you last {meta.verb}?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          This recovery track’s calendar and streak start here.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          <Pill label="Today" active={daysAgo === 0} onPress={() => patchDraft({ startedAtLocalMidnight: localMidnightDaysAgo(0) })} />
          <Pill label="Yesterday" active={daysAgo === 1} onPress={() => patchDraft({ startedAtLocalMidnight: localMidnightDaysAgo(1) })} />
        </View>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="footnote" dim>Days ago</Text>
            <Text variant="title2">{daysAgo} {daysAgo === 1 ? 'day' : 'days'}</Text>
          </View>
          <Stepper
            canDecrement={daysAgo > 0}
            onDec={() => patchDraft({ startedAtLocalMidnight: localMidnightDaysAgo(Math.max(0, daysAgo - 1)) })}
            onInc={() => patchDraft({ startedAtLocalMidnight: localMidnightDaysAgo(daysAgo + 1) })}
          />
        </Card>
      </View>
    );
  }

  if (step.key === 'expense') {
    const expense = draft.expense ?? { amount: 0, period: 'weekly' as const, currency: DEFAULT_CURRENCY };
    return (
      <View>
        <Text variant="title1">What did {meta.label.toLowerCase()} usually cost?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Enter zero if money wasn’t part of this habit. This powers savings estimates.
        </Text>
        <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Average amount</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 64, minHeight: 56, borderRadius: radius.input, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title2" color={theme.color.primary}>{expense.currency}</Text>
          </View>
          <TextInput
            value={formatMoneyInput(String(expense.amount || ''))}
            onChangeText={(value) => patchDraft({ expense: { ...expense, amount: Math.round(parseMoneyInput(value)) } })}
            placeholder="0"
            placeholderTextColor={theme.color.textDim}
            accessibilityLabel="Average expense amount"
            keyboardType="number-pad"
            style={[inputStyle, { flex: 1, fontFamily: fonts.displayHeavy, fontSize: 28 }]}
          />
        </View>
        <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Frequency</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PERIODS.map((period) => (
            <Pill
              key={period}
              label={period[0].toUpperCase() + period.slice(1)}
              active={expense.period === period}
              onPress={() => patchDraft({ expense: { ...expense, period } })}
            />
          ))}
        </View>
        <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Currency</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SUPPORTED_CURRENCIES.map((option) => (
            <Pill
              key={option.code}
              label={`${option.symbol} ${option.code}`}
              active={expense.currency === option.symbol}
              onPress={() => patchDraft({ expense: { ...expense, currency: option.symbol } })}
            />
          ))}
        </View>
      </View>
    );
  }

  if (step.key === 'time_baseline') {
    return (
      <View>
        <Text variant="title1">How much time did this usually take?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Enter your usual minutes per day so progress is specific to this track.
        </Text>
        <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>
          Daily minutes{step.required ? '' : ' (optional)'}
        </Text>
        <TextInput
          value={draft.timeBaselineMinutes == null ? '' : String(draft.timeBaselineMinutes)}
          onChangeText={(value) => {
            const cleaned = value.replace(/\D/g, '').slice(0, 4);
            patchDraft({ timeBaselineMinutes: cleaned ? Number(cleaned) : undefined });
          }}
          placeholder="e.g. 120"
          placeholderTextColor={theme.color.textDim}
          accessibilityLabel="Usual daily time in minutes"
          keyboardType="number-pad"
          style={inputStyle}
        />
      </View>
    );
  }

  if (step.key === 'triggers') {
    return (
      <View>
        <Text variant="title1">What usually triggers this?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Select any that fit {meta.label.toLowerCase()}. You can leave this blank.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {triggerOptions.map((trigger) => (
            <Pill
              key={trigger}
              label={trigger}
              active={draft.triggers.includes(trigger)}
              onPress={() => toggleTrigger(trigger)}
            />
          ))}
        </View>
        {triggerOptions.length === 0 ? (
          <Text variant="footnote" dim>No preset triggers for this category.</Text>
        ) : null}
      </View>
    );
  }

  if (step.key === 'reason') {
    return (
      <View>
        <Text variant="title1">Why does this track matter to you?</Text>
        <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Write a reason specifically for {meta.label.toLowerCase()}.
        </Text>
        <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Recovery reason</Text>
        {reasonSuggestion ? (
          <Button
            label={`Use the same reason as ${reasonSuggestion.label}`}
            kind="secondary"
            onPress={() => patchDraft({ reason: reasonSuggestion.reason })}
            full
            style={{ marginBottom: spacing.md }}
          />
        ) : null}
        <TextInput
          value={draft.reason}
          onChangeText={(reason) => patchDraft({ reason })}
          placeholder="What keeps you committed?"
          placeholderTextColor={theme.color.textDim}
          accessibilityLabel="Recovery reason"
          multiline
          maxLength={320}
          style={[inputStyle, { minHeight: 128, textAlignVertical: 'top' }]}
        />
      </View>
    );
  }

  return (
    <View>
      <Text variant="title1">Review {meta.label}</Text>
      <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        This creates one independent recovery track. Nothing is saved until you confirm the final step.
      </Text>
      <Card>
        <ReviewRow label="Goal" value={goalLabels[draft.goalMode].title} />
        <ReviewRow label="Started" value={`${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`} />
        {draft.addictionDetail ? <ReviewRow label="Focus" value={draft.addictionDetail} /> : null}
        {draft.expense ? (
          <ReviewRow label="Cost" value={`${draft.expense.currency}${draft.expense.amount} / ${draft.expense.period}`} />
        ) : null}
        {draft.timeBaselineMinutes ? <ReviewRow label="Time" value={`${draft.timeBaselineMinutes} min / day`} /> : null}
        <ReviewRow label="Triggers" value={draft.triggers.length ? draft.triggers.join(', ') : 'None selected'} />
        <ReviewRow label="Reason" value={draft.reason || 'Not added'} last />
      </Card>
    </View>
  );
}

function ReviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.color.hairline }}>
      <Text variant="caption" dim>{label}</Text>
      <Text variant="callout" style={{ marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Stepper({
  onDec,
  onInc,
  canDecrement = true,
}: {
  onDec: () => void;
  onInc: () => void;
  canDecrement?: boolean;
}) {
  const theme = useTheme();
  const button = (icon: 'remove' | 'add', onPress: () => void, label: string, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.round,
        backgroundColor: theme.color.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={theme.color.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {button('remove', onDec, 'One day fewer', !canDecrement)}
      {button('add', onInc, 'One day more')}
    </View>
  );
}
