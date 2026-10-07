import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { UploadFile } from '@/services/api/upload';

export type CapturedImage = { uri: string; width: number; height: number };

export type PreparedImage = UploadFile & { width: number; height: number };

export type ImageKind = 'document' | 'selfie';

/** Keeps uploads well under the server's 10 MB multipart limit on any phone camera. */
export const MAX_LONG_SIDE_PX = 2000;
const JPEG_QUALITY = 0.85;

/**
 * Client-side quality floor (CLIENT rule, not a backend rule): below this the text on an ID or a
 * face is too small for review to succeed, so we ask for a retake before spending an upload.
 */
export const MIN_SHORT_SIDE_PX: Record<ImageKind, number> = { document: 720, selfie: 480 };

export class ImageQualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageQualityError';
  }
}

export function checkImageQuality(image: Pick<CapturedImage, 'width' | 'height'>, kind: ImageKind) {
  const shortSide = Math.min(image.width, image.height);
  if (!Number.isFinite(shortSide) || shortSide < MIN_SHORT_SIDE_PX[kind]) {
    throw new ImageQualityError(
      kind === 'document'
        ? 'This photo is too small to read. Move closer so the document fills the frame, or choose a sharper photo.'
        : "This photo is too small. Hold the phone at arm's length in good light and try again.",
    );
  }
}

/** Validates, downsizes and re-encodes a captured/picked photo as JPEG ready for upload. */
export async function prepareImage(source: CapturedImage, kind: ImageKind): Promise<PreparedImage> {
  checkImageQuality(source, kind);

  const context = ImageManipulator.manipulate(source.uri);
  const longSide = Math.max(source.width, source.height);
  if (longSide > MAX_LONG_SIDE_PX) {
    context.resize(
      source.width >= source.height ? { width: MAX_LONG_SIDE_PX } : { height: MAX_LONG_SIDE_PX },
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
