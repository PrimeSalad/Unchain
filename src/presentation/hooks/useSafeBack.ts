import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * Back navigation that can never dead-end or warn. `router.back()` with no
 * history entry (web deep-link/refresh, or a modal reached via `replace`)
 * triggers "The action 'GO_BACK' was not handled by any navigator" and leaves
 * the user stuck. This mirrors BackButton's hardened logic: pop when history
 * exists, otherwise replace to a known-good fallback — and never throw.
 */
export function useSafeBack(fallback: Href = '/(tabs)/home'): () => void {
  const router = useRouter();
  return useCallback(() => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallback);
      }
    } catch {
      try {
        router.replace(fallback);
      } catch {
        /* never crash the screen over a back press */
      }
    }
  }, [router, fallback]);
}
