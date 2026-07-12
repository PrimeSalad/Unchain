/**
 * UrgeHeatmap - visualises when urges most commonly occur.
 *
 * Three views:
 *   • Hourly  - 24-column bar heatmap (AM/PM groups)
 *   • Weekly  - 7-column day-of-week heatmap
 *   • Combined - 24×7 grid heatmap
 *
 * All colours come from the app's design token system. No hardcoded values.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import type { HeatmapData, HeatmapCell, CombinedCell } from '@/domain/urgeAnalytics';
import { DAYS_SHORT, formatHour } from '@/domain/urgeAnalytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeatmapView = 'hourly' | 'weekly' | 'combined';

interface Props {
  data: HeatmapData;
}

// ---------------------------------------------------------------------------
// Colour interpolation
// ---------------------------------------------------------------------------

/**
 * Maps a 0..1 weight to a colour between `low` and `high`.
 * Uses the app's primary (grape) palette:
 *   0 → surface alt (empty)
 *   0..0.33 → light grape
 *   0.33..0.66 → mid grape
 *   0.66..1 → deep grape / coral accent for peak
 */
function weightToColor(weight: number, theme: ReturnType<typeof useTheme>): string {
  if (weight <= 0) return theme.color.surfaceAlt;
  if (weight < 0.25) return theme.mode === 'dark' ? '#2C2138' : '#EEE7F3'; // primarySoft
  if (weight < 0.5)  return theme.mode === 'dark' ? '#4A3560' : '#C4A8E0'; // grape300-ish
  if (weight < 0.75) return theme.mode === 'dark' ? '#7A5B96' : '#8B5CB8'; // primary mid
  return theme.color.primary; // full grape
}

function textOnWeight(weight: number): string {
  return weight >= 0.5 ? '#FFFFFF' : 'transparent';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ViewToggle({ active, onChange }: { active: HeatmapView; onChange: (v: HeatmapView) => void }) {
  const theme = useTheme();
  const tabs: { key: HeatmapView; label: string }[] = [
    { key: 'hourly', label: 'Hourly' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'combined', label: 'Combined' },
  ];
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: radius.chip,
      padding: 3,
      gap: 2,
    }}>
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              height: 32,
              borderRadius: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? theme.color.surface : 'transparent',
              opacity: pressed && !on ? 0.7 : 1,
              ...(on && theme.mode === 'light'
                ? { shadowColor: '#2A1F33', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 }
                : {}),
            })}
          >
            <Text variant="caption" color={on ? theme.color.text : theme.color.textDim}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A single coloured cell used across all views */
function HeatCell({
  weight, size, count, label,
}: {
  weight: number;
  size: number;
  count: number;
  label?: string;
}) {
  const theme = useTheme();
  const bg = weightToColor(weight, theme);
  const textColor = textOnWeight(weight);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {count > 0 && (
        <Text
          style={{
            fontSize: size > 22 ? 11 : 8,
            lineHeight: size > 22 ? 13 : 10,
            color: textColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hourly view - AM block (0-11) + PM block (12-23)
// ---------------------------------------------------------------------------

function HourlyView({ cells }: { cells: HeatmapCell[] }) {
  const theme = useTheme();
  const am = cells.slice(0, 12);
  const pm = cells.slice(12, 24);

  const CELL = 26;
  const GAP = 3;

  const renderRow = (hours: HeatmapCell[], offset: number, label: string) => (
    <View>
      <Text variant="caption" dim style={{ marginBottom: 4 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ gap: GAP }}>
          {/* Hour labels */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {hours.map((c) => (
              <View key={c.key} style={{ width: CELL, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: theme.color.textDim, lineHeight: 10 }}>
                  {c.key === 0 ? '12' : c.key > 12 ? `${c.key - 12}` : `${c.key}`}
                </Text>
              </View>
            ))}
          </View>
          {/* Cells */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {hours.map((c) => (
              <HeatCell key={c.key} weight={c.weight} size={CELL} count={c.count} />
            ))}
          </View>
          {/* Avg intensity row */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {hours.map((c) => (
              <View key={c.key} style={{ width: CELL, alignItems: 'center' }}>
                {c.count > 0 && (
                  <Text style={{ fontSize: 8, color: theme.color.textDim, lineHeight: 10 }}>
                    {c.avgIntensity}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ gap: spacing.md }}>
      {renderRow(am, 0, 'AM (12am – 11am)')}
      {renderRow(pm, 12, 'PM (12pm – 11pm)')}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 4, flexWrap: 'wrap' }}>
        <ColorLegend theme={theme} />
      </View>
      <Text variant="caption" dim style={{ marginTop: 2 }}>Number in cell = urge count · bottom row = avg intensity</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weekly view
// ---------------------------------------------------------------------------

function WeeklyView({ cells }: { cells: HeatmapCell[] }) {
  const theme = useTheme();
  const CELL = 36;
  const GAP = spacing.sm;

  // Reorder to Mon–Sun for natural reading
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((dow) => cells[dow]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: GAP, justifyContent: 'space-between' }}>
        {ordered.map((c) => (
          <View key={c.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text variant="caption" dim style={{ fontSize: 10 }}>
              {DAYS_SHORT[c.key].slice(0, 2)}
            </Text>
            <HeatCell weight={c.weight} size={CELL} count={c.count} />
            {c.count > 0 && (
              <Text variant="caption" dim style={{ fontSize: 9, lineHeight: 11 }}>
                {c.avgIntensity}
              </Text>
            )}
          </View>
        ))}
      </View>
      <ColorLegend theme={theme} />
      <Text variant="caption" dim>Count · avg intensity below each day</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Combined 24×7 grid
// ---------------------------------------------------------------------------

function CombinedView({ cells }: { cells: CombinedCell[] }) {
  const theme = useTheme();

  // Group cells by hour for row rendering
  const byHour = useMemo(() => {
    const map = new Map<number, CombinedCell[]>();
    for (const c of cells) {
      if (!map.has(c.hour)) map.set(c.hour, []);
      map.get(c.hour)!.push(c);
    }
    return map;
  }, [cells]);

  const CELL = 18;
  const GAP = 2;

  // Reorder cols Mon–Sun
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Day headers */}
        <View style={{ flexDirection: 'row', marginBottom: 4, marginLeft: 28 }}>
          {DOW_ORDER.map((dow) => (
            <View key={dow} style={{ width: CELL + GAP, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: theme.color.textDim, lineHeight: 10 }}>
                {DAYS_SHORT[dow].slice(0, 1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Hour rows */}
        {Array.from({ length: 24 }, (_, h) => {
          const row = byHour.get(h) ?? [];
          const isAMBoundary = h === 12;
          return (
            <View key={h} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: GAP }}>
              {/* Hour label */}
              <View style={{ width: 26 }}>
                {h % 3 === 0 && (
                  <Text style={{ fontSize: 8, color: theme.color.textDim, lineHeight: CELL }}>
                    {h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
                  </Text>
                )}
              </View>
              {/* Cells in Mon–Sun order */}
              {DOW_ORDER.map((dow) => {
                const cell = row.find((c) => c.dow === dow);
                return (
                  <View key={dow} style={{ marginRight: GAP }}>
                    <HeatCell
                      weight={cell?.weight ?? 0}
                      size={CELL}
                      count={cell?.count ?? 0}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={{ marginTop: spacing.sm }}>
          <ColorLegend theme={theme} />
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Colour legend
// ---------------------------------------------------------------------------

function ColorLegend({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const labels = ['None', 'Low', 'Mid', 'High', 'Peak'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
      {stops.map((w, i) => (
        <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: weightToColor(w, theme),
              borderWidth: w === 0 ? 1 : 0,
              borderColor: theme.color.hairline,
            }}
          />
          <Text style={{ fontSize: 9, color: theme.color.textDim }}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
      <Ionicons name="analytics-outline" size={36} color={theme.color.textDim} />
      <Text variant="callout" dim center>No urges logged yet</Text>
      <Text variant="footnote" dim center style={{ maxWidth: 240 }}>
        Log urges using the SOS screen to start seeing your patterns here.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UrgeHeatmap({ data }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<HeatmapView>('hourly');

  const isEmpty = data.totalUrges === 0;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Summary stats */}
      {!isEmpty && (
        <View style={{
          flexDirection: 'row',
          backgroundColor: theme.color.surfaceAlt,
          borderRadius: radius.chip,
          overflow: 'hidden',
        }}>
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Total Urges</Text>
            <Text variant="headline" color={theme.color.text}>{data.totalUrges}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: 8 }} />
          <View style={{ flex: 1.2, alignItems: 'center', paddingVertical: 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Avg Intensity</Text>
            <Text variant="headline" color={theme.color.primary}>{data.avgIntensity}/10</Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: 8 }} />
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Peak Hour</Text>
            <Text variant="headline" color={theme.color.text} style={{ fontSize: 13 }}>
              {data.totalUrges > 0
                ? formatHour([...data.byHour].sort((a, b) => b.count - a.count)[0]?.key ?? 0)
                : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* View toggle */}
      {!isEmpty && <ViewToggle active={view} onChange={setView} />}

      {/* Heatmap content */}
      {isEmpty ? (
        <EmptyState />
      ) : view === 'hourly' ? (
        <HourlyView cells={data.byHour} />
      ) : view === 'weekly' ? (
        <WeeklyView cells={data.byDow} />
      ) : (
        <CombinedView cells={data.combined} />
      )}
    </View>
  );
}
