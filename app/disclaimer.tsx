/**
 * Disclaimer & Terms of Use - proper legal text with modern design.
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

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.xl, paddingBottom: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).springify().damping(18)} style={{ marginBottom: spacing.xl }}>
          <Text variant="title1" style={{ fontFamily: 'Nunito_900Black', marginBottom: spacing.xs }}>
            Terms of Use & Disclaimer
          </Text>
          <Text variant="footnote" dim style={{ lineHeight: 20 }}>
            Please read carefully before using this application.
          </Text>
        </Animated.View>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={{ marginBottom: spacing.xl }}>
          <View style={{
            backgroundColor: theme.color.danger + '08',
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.danger + '25',
            padding: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Ionicons name="alert-circle" size={20} color={theme.color.danger} />
              <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.color.danger }}>
                Medical Disclaimer
              </Text>
            </View>
            <Text variant="footnote" style={{ lineHeight: 22, marginBottom: spacing.sm }}>
              Unchainly is a self-help and wellness tool designed to support personal recovery goals across different habits and compulsive behaviors. It is not intended to diagnose, treat, cure, or prevent any disease or medical condition.
            </Text>
            <Text variant="footnote" style={{ lineHeight: 22, marginBottom: spacing.sm }}>
              This application is not a medical device as defined by the FDA or any other regulatory body. It does not provide medical advice, diagnosis, or treatment of any kind.
            </Text>
            <Text variant="footnote" style={{ lineHeight: 22, marginBottom: spacing.sm }}>
              The content, features, and tools within this application are for informational and self-reflection purposes only. They should not be used as a substitute for professional medical advice, diagnosis, or treatment.
            </Text>
            <Text variant="footnote" style={{ lineHeight: 22 }}>
              Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read or done in this application.
            </Text>
          </View>
        </Animated.View>

        {/* ── Terms of Use ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={{ marginBottom: spacing.xl }}>
          <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.md }}>
            Terms of Use
          </Text>

          <TermSection num="1" title="Acceptance of Terms">
            By downloading, installing, or using Unchainly, you agree to be bound by these Terms of Use. If you do not agree to these terms, do not use this application.
          </TermSection>

          <TermSection num="2" title="Description of Service">
            Unchainly is a mobile application that provides voluntary self-help and wellness tools for personal recovery goals across different habits and compulsive behaviors. Features include journaling, progress tracking, habit logging, urge management, planning tools, and educational resources. Recovery categories are provided only to personalize the user's local experience and do not represent separate services or professional treatment programs. All recovery records are stored locally on the user's device.
          </TermSection>

          <TermSection num="3" title="Third-Party Independence">
            Unchainly is an independent self-help application. It is not affiliated with, endorsed by, sponsored by, or connected to any social network, online marketplace, game publisher, content platform, retailer, payment provider, or other third-party service. Any user-entered reference to a third-party product or service remains the responsibility of the user and does not imply a relationship with Unchainly.
          </TermSection>

          <TermSection num="4" title="No Professional Advice">
            All content, features, and tools within this application are for self-reflection and informational purposes only. They do not constitute medical, psychological, financial, or professional advice. The application is not a replacement for professional treatment, therapy, counseling, or medical care.
          </TermSection>

          <TermSection num="5" title="Emergency Situations">
            This application does not provide crisis intervention. If you or someone else may be in immediate danger, contact the emergency services for your current location. For substance withdrawal or other urgent health concerns, seek qualified local medical help. Unchainly does not verify your location or provide emergency services.
          </TermSection>

          <TermSection num="6" title="User Responsibility">
            You are solely responsible for your use of this application and any decisions you make based on its content. Your use of this application is entirely at your own risk. Recovery is a personal journey, and individual results vary.
          </TermSection>

          <TermSection num="7" title="Data Privacy">
            All data entered into this application is stored locally on your device. We do not collect, store, transmit, or have access to any of your personal information, journal entries, or recovery data. You are responsible for the security and backup of your device.
          </TermSection>

          <TermSection num="8" title="No Guarantees">
            This application is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the application will be error-free, uninterrupted, or that it will produce specific results.
          </TermSection>

          <TermSection num="9" title="Limitation of Liability">
            In no event shall the developers, creators, or distributors of this application be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of or inability to use this application.
          </TermSection>

          <TermSection num="10" title="Modifications">
            We reserve the right to modify these terms at any time. Continued use of the application after changes constitutes acceptance of the updated terms. We encourage you to review these terms periodically.
          </TermSection>

          <TermSection num="11" title="Contact">
            If you have questions about these terms, please contact us through the application's support channels.
          </TermSection>
        </Animated.View>

        {/* ── Privacy ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(18)} style={{ marginBottom: spacing.xl }}>
          <View style={{
            backgroundColor: theme.color.success + '08',
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.success + '25',
            padding: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Ionicons name="shield-checkmark" size={20} color={theme.color.success} />
              <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.color.success }}>
                Privacy Policy
              </Text>
            </View>
            <Text variant="footnote" style={{ lineHeight: 22 }}>
              Unchainly is designed with privacy as a core principle. All data is stored exclusively on your device. We do not collect, transmit, or have access to any personal information, journal entries, recovery data, or usage statistics. There are no accounts, no cloud sync, and no analytics tracking. Your recovery journey belongs to you alone.
            </Text>
          </View>
        </Animated.View>

      {/* ── Bottom (fixed) ────────────────────────────────────────────── */}
      <View style={{ paddingBottom: spacing.xl }}>
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setAgreed((v) => !v); }}
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
            width: 24, height: 24, borderRadius: 6,
            borderWidth: 2,
            borderColor: agreed ? theme.color.primary : theme.color.hairline,
            backgroundColor: agreed ? theme.color.primary : 'transparent',
            alignItems: 'center', justifyContent: 'center',
            marginTop: 1,
          }}>
            {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text variant="footnote" style={{ flex: 1, lineHeight: 20 }}>
            I have read and agree to the Terms of Use, Medical Disclaimer, and Privacy Policy.
          </Text>
        </Pressable>

        <Button
          label={agreed ? 'Get Started' : 'Accept & Continue'}
          onPress={handleAccept}
          disabled={!agreed}
          full
        />
      </View>
      </ScrollView>
    </Screen>
  );
}

// ── Term section component ──────────────────────────────────────────────

function TermSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <View style={{
          width: 24, height: 24, borderRadius: 12,
          backgroundColor: theme.color.primarySoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
            {num}
          </Text>
        </View>
        <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>
          {title}
        </Text>
      </View>
      <Text variant="caption" dim style={{ lineHeight: 20, paddingLeft: 32 }}>
        {children}
      </Text>
    </View>
  );
}
