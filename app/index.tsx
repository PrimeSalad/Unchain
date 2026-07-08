import { Redirect } from 'expo-router';
import { useStore } from '@/application/store';

/** Route users to onboarding until they've forged their first chain. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)/home' : '/onboarding'} />;
}
