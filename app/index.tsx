import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '@/application/store';

/** Route users to onboarding until they've completed setup. */
export default function Index() {
  const router = useRouter();
  const onboarded = useStore((s) => s.onboarded);
  const disclaimerAccepted = useStore((s) => s.disclaimerAccepted);
  const didRedirect = useRef(false);

  useEffect(() => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    if (!onboarded) router.replace('/onboarding');
    else if (!disclaimerAccepted) router.replace('/disclaimer');
    else router.replace('/(tabs)/home');
  }, []);

  return null;
}
