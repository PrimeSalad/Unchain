import { Share, type ShareContent } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { isExpoGo } from '@/application/expoGo';

type ShareOptions = {
  uri: string;
  summary: string;
  dialogTitle: string;
  mimeType?: string;
};

export async function captureShareRef(ref: RefObject<View | null>): Promise<string | null> {
  if (isExpoGo()) return null;
  try {
    const { captureRef } = await import('react-native-view-shot');
    return await captureRef(ref, { format: 'png', quality: 1 });
  } catch {
    return null;
  }
}

export async function shareCapturedContent({ uri, summary, dialogTitle, mimeType = 'image/png' }: ShareOptions) {
  try {
    if (uri && !isExpoGo()) {
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType, dialogTitle });
        return;
      }
    }
  } catch {
    /* fall through to plain share */
  }

  const content: ShareContent = { message: summary };
  await Share.share(content).catch(() => {});
}
