import { Fragment, useEffect, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Platform, Pressable, Share, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/presentation/components/Text';
import { fonts, palette, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile } from '@/application/store';
import { ShareActionButton } from '@/presentation/components/ShareActionButton';
import {
  captureShareRef,
  saveShareRefToPhotos,
  saveSvgRefToPhotos,
  saveToPhotosMessage,
  shareCapturedContent,
} from '@/application/shareMedia';
import { DEFAULT_CURRENCY, streakDays, moneySaved, formatMoney, addictionMeta, currentStreakStart } from '@/domain/gambling';
import { computeStats, badgeProgress } from '@/domain/achievements';

const SHARE_MILESTONES = [1, 7, 30, 90, 365] as const;

export default function ShareCard() {
  const safeBack = useSafeBack();
  const theme = useTheme();
  const profile = useProfile();
  const store = useStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const svgRef = useRef<any>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'share' | 'save' | null>(null);
  const busy = pendingAction != null;

  // Navigation is a side effect - never call it during render.
  useEffect(() => {
    if (!profile) safeBack();
  }, [profile, safeBack]);
  if (!profile) return null;

  // Streak + money count from the current clean window (event-derived, same
  // as Home) so a shared card never overstates recovery after a relapse.
  const streakStart = currentStreakStart(profile.startedAt, store.relapses, store.journal);
  const days = streakDays(streakStart);
  const money = moneySaved({ ...profile, startedAt: streakStart });
  const currency = profile.currency ?? DEFAULT_CURRENCY;
  const freeLabel = addictionMeta(profile.addictionType).freeLabel;
  const stats = computeStats({
    profile,
    checkIns: store.checkIns,
    urges: store.urges,
    relapses: store.relapses,
    journal: store.journal,
    reflections: store.reflections,
    timeline: store.timeline,
    points: store.points,
    longestStreak: store.longestStreak,
  });
  const earned = badgeProgress(stats).filter((b) => b.earned).length;
  const savedValue = formatMoney(money.total, currency);
  const shareDate = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const compact = width <= 390 || height <= 844;
  const cardHorizontalPadding = compact ? spacing.lg : spacing.xl;
  const cardPadding = compact ? spacing.lg : spacing.xl;
  const controlsGap = compact ? spacing.sm : spacing.md;
  const controlVerticalPadding = compact ? spacing.md : spacing.xl;
  const availableCardWidth = Math.max(260, width - cardHorizontalPadding * 2);
  const cardMaxWidth = Math.min(availableCardWidth, compact ? 334 : 370);
  const cardMaxHeight = Math.max(360, height - (compact ? 312 : 340));
  const cardWidth = Math.min(cardMaxWidth, Math.max(260, cardMaxHeight * 0.8));
  const dayDigits = String(days).length;
  const dayFontSize =
    dayDigits >= 5 ? (compact ? 66 : 78) :
    dayDigits >= 4 ? (compact ? 76 : 90) :
    dayDigits >= 3 ? (compact ? 92 : 108) :
    compact ? 112 : 132;
  const dayLineHeight = dayFontSize + (compact ? 10 : 12);
  const titleFontSize = compact ? 20 : 24;
  const titleLineHeight = compact ? 25 : 30;
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 0);

  const summary =
    `${days} days ${freeLabel.toLowerCase()} 💜\n` +
    `${savedValue} saved · ${stats.urgesResisted} urges resisted · ${earned} badges\n` +
    `My recovery, one day at a time. - Unchained`;

  const pickPhoto = async () => {
    try {
      // iOS uses the system photo picker (PHPicker) which needs NO library
      // permission - asking anyway shows a needless prompt and blocks the
      // feature when declined. Older Androids may still need the permission.
      if (Platform.OS === 'android') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          // Explain instead of failing silently - the user tapped for a reason.
          Alert.alert(
            'Photo access needed',
            'Allow photo access in Settings to use one of your pictures as the card background.',
          );
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });
      if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
    } catch {
      /* ignore - user can still share the default card */
    }
  };

  const shareImage = async () => {
    setPendingAction('share');
    try {
      const uri = await captureShareRef(cardRef);
      await shareCapturedContent({ uri: uri ?? '', summary, dialogTitle: 'Share your progress' });
    } catch {
      await Share.share({ message: summary }).catch(() => {});
    } finally {
      setPendingAction(null);
    }
  };

  const saveImage = async () => {
    setPendingAction('save');
    try {
      let result = await saveShareRefToPhotos(cardRef);
      if (!result.ok && (result.reason === 'capture-unavailable' || result.reason === 'failed')) {
        result = await saveFallbackSvg();
      }
      const message = saveToPhotosMessage(result);
      Alert.alert(message.title, message.message);
    } finally {
      setPendingAction(null);
    }
  };

  const saveFallbackSvg = () =>
    saveSvgRefToPhotos(svgRef);

  const CardInner = (
    <View style={{ flex: 1, padding: cardPadding, justifyContent: 'space-between', gap: compact ? spacing.xs : spacing.sm }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: compact ? 8 : 9 }}
          resizeMode="cover"
        />
        <Text
          variant="headline"
          color={palette.white}
          numberOfLines={1}
          style={{ marginLeft: spacing.sm, flexShrink: 1, fontSize: compact ? 16 : 17, lineHeight: compact ? 21 : 22 }}
        >
          Unchained
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          variant="caption"
          color="rgba(255,255,255,0.75)"
          numberOfLines={1}
          style={{ maxWidth: compact ? 96 : 124, textAlign: 'right' }}
        >
          {shareDate}
        </Text>
      </View>

      {/* Hero */}
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xs,
          paddingVertical: compact ? 0 : spacing.xs,
          marginTop: compact ? 0 : spacing.xs,
        }}
      >
        <Text
          variant="caption"
          color="rgba(255,255,255,0.72)"
          center
          numberOfLines={1}
          style={{ textTransform: 'uppercase', fontSize: compact ? 10 : 11, lineHeight: compact ? 14 : 15 }}
        >
          Current streak
        </Text>
        <Text
          color={palette.white}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          style={{
            width: '100%',
            marginTop: compact ? spacing.md : spacing.lg,
            textAlign: 'center',
            fontSize: dayFontSize,
            lineHeight: dayLineHeight,
            fontVariant: ['tabular-nums'],
            includeFontPadding: false,
          } as any}
        >
          {days}
        </Text>
        <Text
          color={palette.white}
          center
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={{
            marginTop: compact ? spacing.sm : spacing.md,
            paddingHorizontal: spacing.sm,
            fontSize: titleFontSize,
            lineHeight: titleLineHeight,
            fontFamily: fonts.rounded,
          }}
        >
          Day{days === 1 ? '' : 's'} {freeLabel}
        </Text>
      </View>

      <ShareMilestoneStrip days={days} compact={compact} />

      {/* Stats */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          paddingVertical: compact ? 6 : spacing.sm,
          paddingHorizontal: compact ? spacing.sm : spacing.md,
          marginTop: compact ? spacing.xs : 0,
        }}
      >
        <ShareStat label="Saved" value={savedValue} compact={compact} />
        <ShareDivider />
        <ShareStat label="Urges resisted" value={`${stats.urgesResisted}`} compact={compact} />
        <ShareDivider />
        <ShareStat label="Badges" value={`${earned}`} compact={compact} />
      </View>

      <Text
        variant="caption"
        color="rgba(255,255,255,0.66)"
        center
        numberOfLines={1}
        style={{ fontSize: compact ? 9 : 10, lineHeight: compact ? 12 : 13 }}
      >
        One day at a time
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ProgressFallbackSvg
        svgRef={svgRef}
        days={days}
        freeLabel={freeLabel}
        saved={savedValue}
        urges={`${stats.urgesResisted}`}
        badges={`${earned}`}
        date={shareDate}
      />
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: topInset + spacing.xs,
            paddingBottom: spacing.xs,
          }}
        >
          <Text variant="title2" style={{ flex: 1 }}>Share your progress</Text>
          <Pressable
            onPress={safeBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.round,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: cardHorizontalPadding }}>
          {/* The capture target - a 4:5 shareable card */}
          <View
            ref={cardRef}
            collapsable={false}
            style={{ width: cardWidth, aspectRatio: 4 / 5, alignSelf: 'center', borderRadius: radius.sheet, overflow: 'hidden', ...cardShadow }}
          >
            {photo ? (
              <ImageBackground source={{ uri: photo }} style={{ flex: 1 }} resizeMode="cover">
                <LinearGradient
                  colors={['rgba(42,31,51,0.35)', 'rgba(42,31,51,0.85)']}
                  style={{ flex: 1 }}
                >
                  {CardInner}
                </LinearGradient>
              </ImageBackground>
            ) : (
              <LinearGradient
                colors={[palette.grapeDeep, palette.grape, palette.coralDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              >
                {CardInner}
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Controls */}
        <View
          style={{
            paddingHorizontal: compact ? spacing.lg : spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: controlVerticalPadding,
            gap: controlsGap,
          }}
        >
          <View style={{ flexDirection: 'row', gap: controlsGap }}>
            <ControlButton icon={photo ? 'image' : 'image-outline'} label={photo ? 'Change photo' : 'Add photo'} onPress={pickPhoto} />
            {photo && <ControlButton icon="trash-outline" label="Remove" onPress={() => setPhoto(null)} />}
          </View>
          <ShareActionButton
            icon="download-outline"
            label={pendingAction === 'save' ? 'Saving...' : 'Save to Photos'}
            onPress={saveImage}
            disabled={busy}
            busy={pendingAction === 'save'}
            accessibilityLabel="Save card to Photos"
            kind="secondary"
            style={{ minHeight: compact ? 50 : 54 }}
          />
          <ShareActionButton
            icon="share-social"
            label={pendingAction === 'share' ? 'Preparing...' : 'Share'}
            onPress={shareImage}
            disabled={busy}
            busy={pendingAction === 'share'}
            accessibilityLabel="Share"
            style={{ minHeight: compact ? 50 : 54 }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 24,
  elevation: 12,
} as const;

function ShareMilestoneStrip({ days, compact }: { days: number; compact?: boolean }) {
  const finalMilestone = SHARE_MILESTONES[SHARE_MILESTONES.length - 1];
  const progress = Math.max(0.03, Math.min(1, days / finalMilestone));

  return (
    <View
      style={{
        paddingHorizontal: compact ? spacing.xs : spacing.sm,
        paddingVertical: compact ? 0 : spacing.xs,
      }}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
        <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: spacing.sm }}>
        {SHARE_MILESTONES.map((milestone) => {
          const reached = days >= milestone;
          return (
            <View key={milestone} style={{ alignItems: 'center', width: compact ? 42 : 48 }}>
              <View
                style={{
                  width: compact ? 22 : 24,
                  height: compact ? 22 : 24,
                  borderRadius: radius.round,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: reached ? palette.white : 'rgba(255,255,255,0.16)',
                  borderWidth: reached ? 0 : 1,
                  borderColor: 'rgba(255,255,255,0.24)',
                }}
              >
                {reached ? (
                  <Ionicons name="checkmark" size={compact ? 14 : 15} color={palette.grapeDeep} />
                ) : (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.58)' }} />
                )}
              </View>
              <Text
                variant="caption"
                color={reached ? palette.white : 'rgba(255,255,255,0.68)'}
                center
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  fontSize: compact ? 10 : 11,
                  lineHeight: compact ? 13 : 14,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {milestone}d
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ShareDivider() {
  return <View style={{ width: 1, marginVertical: 4, backgroundColor: 'rgba(255,255,255,0.16)' }} />;
}

function ShareStat({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const valueSize = compact ? 23 : 26;
  const labelSize = compact ? 10 : 11;
  const labelLineHeight = labelSize + 3;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: compact ? 52 : 58,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xs,
      }}
    >
      <Text
        color={palette.white}
        center
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.48}
        style={{
          fontVariant: ['tabular-nums'],
          fontSize: valueSize,
          lineHeight: valueSize + 5,
          fontFamily: fonts.displayBold,
        }}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        color="rgba(255,255,255,0.75)"
        center
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ marginTop: 2, minHeight: labelLineHeight * 2, fontSize: labelSize, lineHeight: labelLineHeight }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressFallbackSvg({
  svgRef,
  days,
  freeLabel,
  saved,
  urges,
  badges,
  date,
}: {
  svgRef: any;
  days: number;
  freeLabel: string;
  saved: string;
  urges: string;
  badges: string;
  date: string;
}) {
  const milestones = SHARE_MILESTONES;
  const startX = 150;
  const endX = 930;
  const y = 890;
  const span = endX - startX;
  const dayFontSize =
    String(days).length >= 5 ? 150 :
    String(days).length >= 4 ? 176 :
    String(days).length >= 3 ? 210 :
    240;
  const freeLabelFontSize = freeLabel.length > 18 ? 38 : 46;
  const savedFontSize = saved.length > 12 ? 28 : saved.length > 9 ? 32 : 38;
  const statFontSize = 38;
  const statLabelFontSize = 22;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -1400, top: 0, width: 1080, height: 1350 }}>
      <Svg ref={svgRef} width={1080} height={1350} viewBox="0 0 1080 1350">
        <Defs>
          <SvgLinearGradient id="shareBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.grapeDeep} />
            <Stop offset="0.48" stopColor={palette.grape} />
            <Stop offset="1" stopColor={palette.coralDeep} />
          </SvgLinearGradient>
          <SvgLinearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        <Rect x="0" y="0" width="1080" height="1350" fill="url(#shareBg)" />
        <Circle cx="950" cy="120" r="220" fill="url(#shine)" />
        <Circle cx="120" cy="1240" r="260" fill="#FFFFFF" opacity="0.08" />

        <Rect x="72" y="72" width="54" height="54" rx="15" fill="#FFFFFF" opacity="0.18" />
        <SvgText x="150" y="112" fill="#FFFFFF" fontSize="36" fontWeight="800">
          Unchained
        </SvgText>
        <SvgText x="1008" y="108" fill="#FFFFFF" opacity="0.76" fontSize="27" textAnchor="end">
          {date}
        </SvgText>

        <SvgText x="540" y="455" fill="#FFFFFF" fontSize={dayFontSize} fontWeight="900" textAnchor="middle">
          {String(days)}
        </SvgText>
        <SvgText x="540" y="540" fill="#FFFFFF" fontSize={freeLabelFontSize} fontWeight="800" textAnchor="middle">
          Day{days === 1 ? '' : 's'} {freeLabel}
        </SvgText>

        <Line x1={startX} y1={y} x2={endX} y2={y} stroke="#FFFFFF" strokeOpacity="0.26" strokeWidth="14" strokeLinecap="round" />
        {milestones.map((milestone, index) => {
          const x = startX + (span * index) / (milestones.length - 1);
          const reached = days >= milestone;
          return (
            <Fragment key={milestone}>
              <Circle cx={x} cy={y} r={reached ? 24 : 18} fill={reached ? '#FFFFFF' : 'rgba(255,255,255,0.22)'} />
              <SvgText
                x={x}
                y={y + 66}
                fill="#FFFFFF"
                opacity={reached ? 1 : 0.68}
                fontSize="24"
                fontWeight={reached ? '800' : '600'}
                textAnchor="middle"
              >
                {milestone}d
              </SvgText>
            </Fragment>
          );
        })}

        <SvgText x="228" y="1114" fill="#FFFFFF" fontSize={savedFontSize} fontWeight="900" textAnchor="middle">
          {saved}
        </SvgText>
        <SvgText x="228" y="1152" fill="#FFFFFF" opacity="0.75" fontSize={statLabelFontSize} textAnchor="middle">
          Saved
        </SvgText>
        <Line x1="384" y1="1072" x2="384" y2="1160" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="3" />
        <SvgText x="540" y="1114" fill="#FFFFFF" fontSize={statFontSize} fontWeight="900" textAnchor="middle">
          {urges}
        </SvgText>
        <SvgText x="540" y="1152" fill="#FFFFFF" opacity="0.75" fontSize={statLabelFontSize} textAnchor="middle">
          Urges resisted
        </SvgText>
        <Line x1="696" y1="1072" x2="696" y2="1160" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="3" />
        <SvgText x="852" y="1114" fill="#FFFFFF" fontSize={statFontSize} fontWeight="900" textAnchor="middle">
          {badges}
        </SvgText>
        <SvgText x="852" y="1152" fill="#FFFFFF" opacity="0.75" fontSize={statLabelFontSize} textAnchor="middle">
          Badges
        </SvgText>
        <SvgText x="540" y="1252" fill="#FFFFFF" opacity="0.7" fontSize="24" fontWeight="700" textAnchor="middle">
          One day at a time
        </SvgText>
      </Svg>
    </View>
  );
}

function ControlButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1, height: 48, borderRadius: radius.button,
        backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: spacing.sm, opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={theme.color.primary} />
      <Text variant="callout" color={theme.color.text}>{label}</Text>
    </Pressable>
  );
}
