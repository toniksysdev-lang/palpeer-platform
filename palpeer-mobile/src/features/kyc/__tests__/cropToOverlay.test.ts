import { cropRectForOverlay, overlayFrameInView } from '../cropToOverlay';

describe('cropToOverlay', () => {
  it('centers the face guide at 64% width with aspect 0.78', () => {
    const frame = overlayFrameInView({ width: 390, height: 844 }, 'face');
    expect(frame.width).toBeCloseTo(390 * 0.64);
    expect(frame.height).toBeCloseTo(frame.width / 0.78);
    expect(frame.originX).toBeCloseTo((390 - frame.width) / 2);
    expect(frame.originY).toBeCloseTo((844 - frame.height) / 2);
  });

  it('centers the document guide at 86% width with aspect 1.58', () => {
    const frame = overlayFrameInView({ width: 390, height: 844 }, 'document');
    expect(frame.width).toBeCloseTo(390 * 0.86);
    expect(frame.height).toBeCloseTo(frame.width / 1.58);
    expect(frame.originX).toBeCloseTo((390 - frame.width) / 2);
  });

  it('maps the face frame into a smaller crop of a taller cover-fitted image', () => {
    // Portrait phone preview, landscape-ish sensor covered to fill.
    const image = { width: 4032, height: 3024 };
    const view = { width: 390, height: 844 };
    const crop = cropRectForOverlay(image, view, 'face');

    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(image.width);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(image.height);
    // Crop must be tighter than the full frame.
    expect(crop.width * crop.height).toBeLessThan(image.width * image.height * 0.55);
  });

  it('keeps the crop inside bounds when image and view share the same aspect', () => {
    const size = { width: 1080, height: 1920 };
    const crop = cropRectForOverlay(size, size, 'document');
    expect(crop.originX).toBeGreaterThanOrEqual(0);
    expect(crop.originY).toBeGreaterThanOrEqual(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(size.width);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(size.height);
    expect(crop.width / crop.height).toBeCloseTo(1.58, 1);
  });
});
