import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image, Platform } from 'react-native';

import type { UploadFile } from '@/services/api/upload';

export type CapturedImage = { uri: string; width: number; height: number };

export type PreparedImage = UploadFile & { width: number; height: number };

export type ImageKind = 'document' | 'selfie';

/** Keeps uploads well under the server's 10 MB multipart limit on any phone camera. */
export const MAX_LONG_SIDE_PX = 2000;
const JPEG_QUALITY = 0.85;

/**
 * Client-side quality floor (CLIENT rule, not a backend rule).
 *
 * Document floor is 480 (not 720) because Expo Camera on web captures from the
 * getUserMedia stream at the browser default — typically 640×480 VGA — so a
 * 720px short-side gate rejected every valid webcam photo of an ID.
 */
export const MIN_SHORT_SIDE_PX: Record<ImageKind, number> = { document: 480, selfie: 480 };

export class ImageQualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageQualityError';
  }
}

function isUsableSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function shortSide(size: { width: number; height: number }): number {
  return Math.min(size.width, size.height);
}

function qualityError(kind: ImageKind): ImageQualityError {
  return new ImageQualityError(
    kind === 'document'
      ? 'This photo is too small to read. Move closer so the document fills the frame, or choose a sharper photo.'
      : "This photo is too small. Hold the phone at arm's length in good light and try again.",
  );
}

export function checkImageQuality(image: Pick<CapturedImage, 'width' | 'height'>, kind: ImageKind) {
  const side = shortSide(image);
  if (!Number.isFinite(side) || side < MIN_SHORT_SIDE_PX[kind]) {
    throw qualityError(kind);
  }
}

function measureWithGetSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (!isUsableSize(width, height)) {
          reject(new Error('Image.getSize returned an empty size'));
          return;
        }
        resolve({ width, height });
      },
      (error) => reject(error ?? new Error('Image.getSize failed')),
    );
  });
}

/** Most reliable for data:/blob: URIs from the web camera / file picker. */
function measureWithHtmlImage(uri: string): Promise<{ width: number; height: number }> {
  if (Platform.OS !== 'web') {
    return Promise.reject(new Error('HTML image measure is web-only'));
  }
  const BrowserImage = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  if (!BrowserImage) {
    return Promise.reject(new Error('Browser Image is unavailable'));
  }
  return new Promise((resolve, reject) => {
    const img = new BrowserImage();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!isUsableSize(width, height)) {
        reject(new Error('HTML image returned an empty size'));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => reject(new Error('HTML image failed to load'));
    img.src = uri;
  });
}

async function measureWithManipulator(uri: string): Promise<{ width: number; height: number }> {
  const rendered = await ImageManipulator.manipulate(uri).renderAsync();
  const width = rendered.width;
  const height = rendered.height;
  if (!isUsableSize(width, height)) {
    throw new Error('ImageManipulator returned an empty size');
  }
  return { width, height };
}

/**
 * Camera / library pickers (especially on web) often omit or under-report width/height
 * (Expo web camera puts MediaTrackSettings into width/height, which can be 0).
 * Prefer decoding the actual image bytes; only fall back to reported size if every
 * probe fails.
 */
export async function resolveImageDimensions(
  source: CapturedImage,
): Promise<{ width: number; height: number }> {
  const measured: { width: number; height: number }[] = [];
  const probes = [measureWithHtmlImage, measureWithGetSize, measureWithManipulator];
  await Promise.all(
    probes.map(async (probe) => {
      try {
        measured.push(await probe(source.uri));
      } catch {
        // try the next probe
      }
    }),
  );

  if (measured.length > 0) {
    return measured.reduce((best, current) =>
      shortSide(current) > shortSide(best) ? current : best,
    );
  }

  if (isUsableSize(source.width, source.height)) {
    return { width: source.width, height: source.height };
  }

  throw new Error('Could not measure image dimensions');
}

/** Validates, downsizes and re-encodes a captured/picked photo as JPEG ready for upload. */
export async function prepareImage(source: CapturedImage, kind: ImageKind): Promise<PreparedImage> {
  const size = await resolveImageDimensions(source);
  checkImageQuality(size, kind);

  const context = ImageManipulator.manipulate(source.uri);
  const longSide = Math.max(size.width, size.height);
  if (longSide > MAX_LONG_SIDE_PX) {
    context.resize(
      size.width >= size.height ? { width: MAX_LONG_SIDE_PX } : { height: MAX_LONG_SIDE_PX },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    name: `${kind}-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  };
}
