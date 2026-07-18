/**
 * Disclaimer & Terms of Use screen.
 * Shown after onboarding completes, before the user enters the app.
 */

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

export default function Disclaimer() {
  const theme = useTheme();
  const router = useRouter();
  const acceptDisclaimer = useStore((s) => s.acceptDisclaimer);
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    acceptDisclaimer();
    router.replace('/(tabs)/home');
  };

  const toggleAgree = () => {
    Haptics.selectionAsync().catch(() => {});
    setAgreed((v) => !v);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>Welcome</Text>
        <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
          Please review and accept our terms before continuing.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Disclaimer Banner ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: theme.color.danger + '15',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="alert-circle" size={18} color={theme.color.danger} />
              </View>
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
                Medical Disclaimer
              </Text>
            </View>
            <Text variant="caption" style={{ lineHeight: 20 }}>
              This app is a self-help tool for personal recovery support. It is{' '}
              <Text style={{ fontFamily: 'Nunito_700Bold' }}>not a medical device</Text> and does not
              provide medical advice, diagnosis, or treatment. It is not a substitute for
              professional healthcare, therapy, or emergency services.
            </Text>
          </View>
        </Animated.View>

        {/* ── Terms of Use ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(18)}>
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.md }}>
              Terms of Use
            </Text>

            <View style={{ gap: spacing.md }}>
              <Section title="Use at Your Own Risk" theme={theme}>
                Your use of this app is entirely at your own risk. The app is provided as-is
                without warranties. We do not guarantee it will be error-free or produce specific results.
              </Section>

              <Section title="No Professional Advice" theme={theme}>
                All content, tracking tools, journal prompts, and reflections are for
                self-reflection only. They do not constitute medical, psychological, or
                professional advice. Always consult qualified professionals.
              </Section>

              <Section title="Emergency Situations" theme={theme}>
                This app is not designed for crisis intervention. If you or someone you know
                is in immediate danger, contact emergency services or go to the nearest
                emergency room.
              </Section>

              <Section title="Your Data Stays Private" theme={theme}>
                All data is stored locally on your device. Nothing is uploaded to servers.
                We have no access to your information. You are responsible for your device security.
              </Section>

              <Section title="Results Vary" theme={theme}>
                Recovery is deeply personal. Progress indicators and insights are based on
                your own self-reported data. Results vary between individuals and should
                not be compared to clinical outcomes.
              </Section>
            </View>
          </View>
        </Animated.View>

        {/* ── Privacy Note ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
            backgroundColor: theme.color.successSoft,
            borderRadius: radius.card,
            padding: spacing.md,
            marginBottom: spacing.xl,
          }}>
            <Ionicons name="shield-checkmark" size={18} color={theme.color.success} style={{ marginTop: 2 }} />
            <Text variant="caption" style={{ flex: 1, lineHeight: 19 }}>
              <Text style={{ fontFamily: 'Nunito_700Bold', color: theme.color.success }}>Privacy First.</Text>{' '}
              No accounts, no cloud sync, no tracking. Everything stays on your device.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Bottom: Checkbox + Button ──────────────────────────────────────── */}
      <View style={{ paddingBottom: spacing.xl }}>
        {/* Checkbox row */}
        <Pressable
          onPress={toggleAgree}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.md,
            marginBottom: spacing.lg,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{
            width: 22, height: 22, borderRadius: 6,
            borderWidth: 2,
            borderColor: agreed ? theme.color.primary : theme.color.hairline,
            backgroundColor: agreed ? theme.color.primary : 'transparent',
            alignItems: 'center', justifyContent: 'center',
            marginTop: 1,
          }}>
            {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text variant="footnote" style={{ flex: 1, lineHeight: 20, color: theme.color.text }}>
            I have read and agree to the Terms of Use and understand this app is not a substitute for professional medical advice.
          </Text>
        </Pressable>

        {/* Action button */}
        <Button
          label={agreed ? 'Get Started' : 'Accept Terms to Continue'}
          onPress={handleAccept}
          disabled={!agreed}
          full
        />
      </View>
    </Screen>
  );
}

// ── Section sub-component ─────────────────────────────────────────────────

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: any }) {
  return (
    <View>
      <Text variant="caption" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.xs }}>
        {title}
      </Text>
      <Text variant="caption" dim style={{ lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}
