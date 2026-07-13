import { Share, type ShareContent } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';

type ShareOptions = {
  uri: string;
  summary: string;
  dialogTitle: string;
  mimeType?: string;
};

type SvgDataUrlRef = {
  toDataURL?: (callback: (base64: string) => void, options?: object) => void;
};

export type SaveToPhotosResult =
  | { ok: true }
  | { ok: false; reason: 'capture-unavailable' | 'permission-denied' | 'unavailable' | 'failed' };

function cleanBase64Png(base64: string) {
  return base64.replace(/^data:image\/png;base64,/, '');
}

export async function writePngBase64ToCache(base64: string, fileName = 'unchainly-share'): Promise<string | null> {
  const cleaned = cleanBase64Png(base64);
  if (!cleaned) return null;

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!root) return null;

    const uri = `${root}${fileName}-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, cleaned, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  } catch {
    return null;
  }
}

export async function captureShareRef(ref: RefObject<View | null>): Promise<string | null> {
  try {
    const { captureRef } = await import('react-native-view-shot');
    const base64 = await captureRef(ref, { format: 'png', quality: 1, result: 'base64' });
    return await writePngBase64ToCache(base64);
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

  return saveImageFileToPhotos(uri);
}

export async function savePngBase64ToPhotos(base64: string): Promise<SaveToPhotosResult> {
  const uri = await writePngBase64ToCache(base64);
  if (!uri) return { ok: false, reason: 'capture-unavailable' };
  return saveImageFileToPhotos(uri);
}

export function saveSvgRefToPhotos(ref: RefObject<SvgDataUrlRef | null>): Promise<SaveToPhotosResult> {
  return new Promise((resolve) => {
    const svg = ref.current;
    if (!svg || typeof svg.toDataURL !== 'function') {
      resolve({ ok: false, reason: 'capture-unavailable' });
      return;
    }

    try {
      svg.toDataURL(async (base64: string) => {
        if (!base64) {
          resolve({ ok: false, reason: 'capture-unavailable' });
          return;
        }
        resolve(await savePngBase64ToPhotos(base64));
      }, { width: 1080, height: 1350 });
    } catch {
      resolve({ ok: false, reason: 'failed' });
    }
  });
}

export async function saveImageFileToPhotos(uri: string): Promise<SaveToPhotosResult> {
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
        message: 'Allow Unchained to add photos in Settings, then try saving again.',
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
