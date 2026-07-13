import { Share, type ShareContent } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';

type ShareOptions = {
  uri: string;
  summary: string;
  dialogTitle: string;
  mimeType?: string;
};

export type SaveToPhotosResult =
  | { ok: true }
  | { ok: false; reason: 'capture-unavailable' | 'permission-denied' | 'unavailable' | 'failed' };

export async function captureShareRef(ref: RefObject<View | null>): Promise<string | null> {
  try {
    const { captureRef } = await import('react-native-view-shot');
    return await captureRef(ref, { format: 'png', quality: 1 });
  } catch {
    return null;
  }
}

export async function shareCapturedContent({ uri, summary, dialogTitle, mimeType = 'image/png' }: ShareOptions) {
  try {
    if (uri) {
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

export async function saveShareRefToPhotos(ref: RefObject<View | null>): Promise<SaveToPhotosResult> {
  const uri = await captureShareRef(ref);
  if (!uri) return { ok: false, reason: 'capture-unavailable' };

  try {
    const MediaLibrary = await import('expo-media-library');
    if (
      typeof MediaLibrary.requestPermissionsAsync !== 'function' ||
      typeof MediaLibrary.saveToLibraryAsync !== 'function'
    ) {
      return { ok: false, reason: 'unavailable' };
    }

    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return { ok: false, reason: 'permission-denied' };

    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export function saveToPhotosMessage(result: SaveToPhotosResult): { title: string; message: string } {
  if (result.ok) {
    return {
      title: 'Saved to Photos',
      message: 'Your share card was saved to your photo library.',
    };
  }

  switch (result.reason) {
    case 'permission-denied':
      return {
        title: 'Photo access needed',
        message: 'Allow Unchainly to add photos in Settings, then try saving again.',
      };
    case 'capture-unavailable':
      return {
        title: 'Could not render image',
        message: 'This build could not create the share image. You can still use Share.',
      };
    case 'unavailable':
      return {
        title: 'Photos unavailable',
        message: 'Saving to Photos is not available on this device or platform.',
      };
    default:
      return {
        title: 'Save failed',
        message: 'The card could not be saved right now. Please try again.',
      };
  }
}
