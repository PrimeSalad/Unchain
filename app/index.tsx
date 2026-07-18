import { Redirect } from 'expo-router';
import { useStore } from '@/application/store';

/** Route users to onboarding until they've completed setup. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  const disclaimerAccepted = useStore((s) => s.disclaimerAccepted);
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!disclaimerAccepted) return <Redirect href="/disclaimer" />;
  return <Redirect href="/(tabs)/home" />;
}
