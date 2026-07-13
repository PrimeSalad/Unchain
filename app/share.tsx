import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Platform, Pressable, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/presentation/components/Text';
import { Roadmap } from '@/presentation/components/Roadmap';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile } from '@/application/store';
import { ShareActionButton } from '@/presentation/components/ShareActionButton';
import { captureShareRef, saveShareRefToPhotos, saveToPhotosMessage, shareCapturedContent } from '@/application/shareMedia';
import { streakDays, moneySaved, formatMoney, addictionMeta, currentStreakStart } from '@/domain/gambling';
import { computeStats, badgeProgress } from '@/domain/achievements';

export default function ShareCard() {
  const safeBack = useSafeBack();
  const theme = useTheme();
  const profile = useProfile();
  const store = useStore();
  const cardRef = useRef<View>(null);

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

  const summary =
    `${days} days ${freeLabel.toLowerCase()} 💜\n` +
    `${formatMoney(money.total, currency)} saved · ${stats.urgesResisted} urges resisted · ${earned} badges\n` +
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
      const result = await saveShareRefToPhotos(cardRef);
      const message = saveToPhotosMessage(result);
      Alert.alert(message.title, message.message);
    } finally {
      setPendingAction(null);
    }
  };

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
          {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
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
        <ShareStat label="Saved" value={formatMoney(money.total, currency)} />
        <ShareStat label="Urges resisted" value={`${stats.urgesResisted}`} />
        <ShareStat label="Badges" value={`${earned}`} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
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
