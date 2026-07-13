import { Fragment, useEffect, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Platform, Pressable, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { Roadmap } from '@/presentation/components/Roadmap';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
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
import { streakDays, moneySaved, formatMoney, addictionMeta, currentStreakStart } from '@/domain/gambling';
import { computeStats, badgeProgress } from '@/domain/achievements';

export default function ShareCard() {
  const safeBack = useSafeBack();
  const theme = useTheme();
  const profile = useProfile();
  const store = useStore();
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
  const currency = profile.currency ?? '₱';
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

  const summary =
    `${days} days ${freeLabel.toLowerCase()} 💜\n` +
    `${savedValue} saved · ${stats.urgesResisted} urges resisted · ${earned} badges\n` +
    `My recovery, one day at a time. - Unchainly`;

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
    <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'space-between' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 32, height: 32, borderRadius: 9 }}
          resizeMode="cover"
        />
        <Text variant="headline" color={palette.white} style={{ marginLeft: spacing.sm, letterSpacing: 0.5 }}>Unchainly</Text>
        <View style={{ flex: 1 }} />
        <Text variant="caption" color="rgba(255,255,255,0.75)">
          {shareDate}
        </Text>
      </View>

      {/* Hero */}
      <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
        <Text color={palette.white} style={{ fontSize: 96, lineHeight: 100, fontVariant: ['tabular-nums'], includeFontPadding: false } as any}>
          {days}
        </Text>
        <Text variant="title2" color={palette.white} style={{ marginTop: spacing.xs }}>
          Day{days === 1 ? '' : 's'} {freeLabel}
        </Text>
      </View>

      {/* Roadmap */}
      <Roadmap
        days={days}
        reachedColor={palette.white}
        nodeColor="rgba(255,255,255,0.18)"
        trackColor="rgba(255,255,255,0.25)"
        textColor={palette.white}
        dimColor="rgba(255,255,255,0.7)"
        accentColor={palette.honey}
      />

      {/* Stats */}
      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
        <ShareStat label="Saved" value={savedValue} />
        <ShareStat label="Urges resisted" value={`${stats.urgesResisted}`} />
        <ShareStat label="Badges" value={`${earned}`} />
      </View>
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
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Text variant="title2" style={{ flex: 1 }}>Share your progress</Text>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          {/* The capture target - a 4:5 shareable card */}
          <View
            ref={cardRef}
            collapsable={false}
            style={{ aspectRatio: 4 / 5, borderRadius: radius.sheet, overflow: 'hidden', ...cardShadow }}
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
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
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
          />
          <ShareActionButton
            icon="share-social"
            label={pendingAction === 'share' ? 'Preparing...' : 'Share'}
            onPress={shareImage}
            disabled={busy}
            busy={pendingAction === 'share'}
            accessibilityLabel="Share"
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

function ShareStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="title2" color={palette.white} style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color="rgba(255,255,255,0.75)">{label}</Text>
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
  const milestones = [1, 7, 30, 90, 365];
  const startX = 150;
  const endX = 930;
  const y = 890;
  const span = endX - startX;

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
          Unchainly
        </SvgText>
        <SvgText x="1008" y="108" fill="#FFFFFF" opacity="0.76" fontSize="27" textAnchor="end">
          {date}
        </SvgText>

        <SvgText x="540" y="430" fill="#FFFFFF" fontSize="190" fontWeight="900" textAnchor="middle">
          {String(days)}
        </SvgText>
        <SvgText x="540" y="502" fill="#FFFFFF" fontSize="43" fontWeight="800" textAnchor="middle">
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

        <Rect x="72" y="1035" width="936" height="152" rx="34" fill="#FFFFFF" opacity="0.13" />
        <SvgText x="144" y="1112" fill="#FFFFFF" fontSize="38" fontWeight="800">
          {saved}
        </SvgText>
        <SvgText x="144" y="1158" fill="#FFFFFF" opacity="0.75" fontSize="24">
          Saved
        </SvgText>
        <SvgText x="540" y="1112" fill="#FFFFFF" fontSize="38" fontWeight="800" textAnchor="middle">
          {urges}
        </SvgText>
        <SvgText x="540" y="1158" fill="#FFFFFF" opacity="0.75" fontSize="24" textAnchor="middle">
          Urges resisted
        </SvgText>
        <SvgText x="936" y="1112" fill="#FFFFFF" fontSize="38" fontWeight="800" textAnchor="end">
          {badges}
        </SvgText>
        <SvgText x="936" y="1158" fill="#FFFFFF" opacity="0.75" fontSize="24" textAnchor="end">
          Badges
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
