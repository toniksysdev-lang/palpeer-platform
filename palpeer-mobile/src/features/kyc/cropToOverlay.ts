import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { resolveImageDimensions, type CapturedImage } from './image';

export type OverlayKind = 'document' | 'face';

export type ViewSize = { width: number; height: number };

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/** Must stay in sync with `CameraCapture` overlay styles. */
const OVERLAY_WIDTH_RATIO: Record<OverlayKind, number> = {
  document: 0.86,
  face: 0.64,
};

/** width / height of the guide frame. */
const OVERLAY_ASPECT: Record<OverlayKind, number> = {
  document: 1.58,
  face: 0.78,
};

/** Centered guide rectangle in view coordinates (matches the on-screen frame). */
export function overlayFrameInView(view: ViewSize, overlay: OverlayKind): CropRect {
  const width = view.width * OVERLAY_WIDTH_RATIO[overlay];
  const height = width / OVERLAY_ASPECT[overlay];
  return {
    originX: (view.width - width) / 2,
    originY: (view.height - height) / 2,
    width,
    height,
  };
}

/**
 * Maps a rectangle from a cover-fitted preview into source-image pixels.
 * CameraView / web video `object-fit: cover` both use this geometry.
 */
export function mapCoverRectToImage(
  image: ViewSize,
  view: ViewSize,
  frameInView: CropRect,
): CropRect {
  const scale = Math.max(view.width / image.width, view.height / image.height);
  const displayedW = image.width * scale;
  const displayedH = image.height * scale;
  const offsetX = (displayedW - view.width) / 2;
  const offsetY = (displayedH - view.height) / 2;

  let originX = (frameInView.originX + offsetX) / scale;
  let originY = (frameInView.originY + offsetY) / scale;
  let width = frameInView.width / scale;
  let height = frameInView.height / scale;

  // Clamp to image bounds (rounding / floating point).
  originX = Math.max(0, Math.min(originX, image.width - 1));
  originY = Math.max(0, Math.min(originY, image.height - 1));
  width = Math.max(1, Math.min(width, image.width - originX));
  height = Math.max(1, Math.min(height, image.height - originY));

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Crop rectangle for the overlay frame given preview layout and captured image size. */
export function cropRectForOverlay(
  image: ViewSize,
  view: ViewSize,
  overlay: OverlayKind,
): CropRect {
  return mapCoverRectToImage(image, view, overlayFrameInView(view, overlay));
}

/**
 * Crops a full camera capture down to the on-screen guide frame.
 * Falls back to the original image if layout is unknown or crop fails.
 */
export async function cropCapturedToOverlay(
  source: CapturedImage,
  view: ViewSize | null,
  overlay: OverlayKind,
): Promise<CapturedImage> {
  if (!view || view.width <= 0 || view.height <= 0) return source;

  let width = source.width;
  let height = source.height;
  if (width <= 0 || height <= 0) {
    try {
      const measured = await resolveImageDimensions(source);
      width = measured.width;
      height = measured.height;
    } catch {
      return source;
    }
  }

  const rect = cropRectForOverlay({ width, height }, view, overlay);

  // Degenerate / near-full-frame crop — keep the original.
  if (
    rect.width < 8 ||
    rect.height < 8 ||
    (rect.width >= width - 2 && rect.height >= height - 2)
  ) {
    return source.width > 0 ? source : { ...source, width, height };
  }

  const rendered = await ImageManipulator.manipulate(source.uri).crop(rect).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
  };
}
