import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Image, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const PDF_PAGE_WIDTH = 612;

export class ReceiptShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device.');
    this.name = 'ReceiptShareUnavailableError';
  }
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

async function assertSharingAvailable(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ReceiptShareUnavailableError();
  }
}

/** Capture the on-screen receipt view as a PNG at native pixel density. */
export async function captureReceiptPng(
  viewRef: RefObject<View | null>,
  fileName = 'p2p-receipt',
): Promise<string> {
  return captureRef(viewRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: fileName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'p2p-receipt',
  });
}

/** Share the captured receipt as a PNG (Save Image / share sheet). */
export async function saveReceiptAsImage(
  viewRef: RefObject<View | null>,
  fileName = 'p2p-receipt',
): Promise<void> {
  await assertSharingAvailable();
  const uri = await captureReceiptPng(viewRef, fileName);
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Save as image',
    UTI: 'public.png',
  });
}

/**
 * Capture the same on-screen view, embed it full-bleed in a PDF page sized to the
 * image aspect ratio, then open the share sheet so the user can save the PDF.
 */
export async function saveReceiptAsPdf(
  viewRef: RefObject<View | null>,
  fileName = 'p2p-receipt',
): Promise<void> {
  await assertSharingAvailable();
  const imageUri = await captureReceiptPng(viewRef, fileName);
  const [base64, size] = await Promise.all([
    FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 }),
    imageSize(imageUri),
  ]);
  const pageHeight = Math.max(
    1,
    Math.round((size.height / Math.max(size.width, 1)) * PDF_PAGE_WIDTH),
  );
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: ${PDF_PAGE_WIDTH}pt ${pageHeight}pt; }
  html, body { margin: 0; padding: 0; width: ${PDF_PAGE_WIDTH}px; height: ${pageHeight}px; }
  img { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
  <img src="data:image/png;base64,${base64}" alt="P2P trade receipt" />
</body>
</html>`;
  const pdf = await Print.printToFileAsync({
    html,
    width: PDF_PAGE_WIDTH,
    height: pageHeight,
  });
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save as PDF',
    UTI: 'com.adobe.pdf',
  });
}
