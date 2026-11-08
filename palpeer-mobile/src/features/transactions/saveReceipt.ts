import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Image, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const PDF_PAGE_WIDTH = 612;

export class ReceiptShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device.');
    this.name = 'ReceiptShareUnavailableError';
  }
}

export type ReceiptContent = {
  title: string;
  rows: ReadonlyArray<{ label: string; value: string } | [string, string]>;
  status?: string;
  note?: string;
  when?: string;
  steps?: ReadonlyArray<string>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeRows(
  rows: ReceiptContent['rows'],
): { label: string; value: string }[] {
  return rows.map((r) => (Array.isArray(r) ? { label: r[0], value: r[1] } : r));
}

function safeFileName(fileName: string, fallback = 'p2p-receipt'): string {
  return fileName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || fallback;
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

/** Build a self-contained HTML receipt (used for PDF and web image fallback). */
export function buildReceiptHtml(content: ReceiptContent): string {
  const rows = normalizeRows(content.rows)
    .map(
      (r) =>
        `<tr><td class="label">${escapeHtml(r.label)}</td><td class="value">${escapeHtml(
          r.value,
        )}</td></tr>`,
    )
    .join('');
  const steps =
    content.steps && content.steps.length
      ? `<div class="section"><div class="overline">Progress</div><div class="step">Requested</div>${content.steps
          .map((s) => `<div class="step">${escapeHtml(s)}</div>`)
          .join('')}</div>`
      : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: #F3F6F4; color: #0E1F19; }
  h1 { font-size: 28px; font-weight: 800; margin: 0 0 16px; }
  .card { background: #FFFFFF; border-radius: 22px; padding: 16px 18px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; vertical-align: top; font-size: 17px; }
  td.label { font-weight: 600; color: #33453D; padding-right: 12px; }
  td.value { font-weight: 800; text-align: right; }
  .rule { height: 1px; background: #DDE4E0; margin: 10px 0; }
  .status { font-weight: 800; color: #0B6E4F; margin-bottom: 6px; }
  .note, .when { font-size: 15px; font-weight: 600; color: #33453D; margin: 2px 0; }
  .when { color: #46574F; }
  .overline { font-size: 12px; font-weight: 700; color: #5B6B64; text-transform: uppercase; margin-bottom: 8px; }
  .step { font-size: 15px; font-weight: 600; color: #33453D; margin: 4px 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.title || 'Receipt')}</h1>
  <div class="card">
    <table>${rows}</table>
    <div class="rule"></div>
    ${content.status ? `<div class="status">${escapeHtml(content.status)}</div>` : ''}
    ${content.note ? `<div class="note">${escapeHtml(content.note)}</div>` : ''}
    ${content.when ? `<div class="when">${escapeHtml(content.when)}</div>` : ''}
  </div>
  ${steps}
</body>
</html>`;
}

async function downloadOnWeb(uri: string, fileName: string, mimeType: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new ReceiptShareUnavailableError();
  }
  let href = uri;
  let revoke: string | null = null;
  if (!uri.startsWith('data:') && !uri.startsWith('blob:')) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const typed =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob
        : new Blob([blob], { type: mimeType });
    href = URL.createObjectURL(typed);
    revoke = href;
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(revoke);
}

/** Share via the system sheet, or download the file on web when sharing is unavailable. */
async function shareOrDownload(
  uri: string,
  options: {
    mimeType: string;
    dialogTitle: string;
    UTI: string;
    fileName: string;
  },
): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: options.mimeType,
      dialogTitle: options.dialogTitle,
      UTI: options.UTI,
    });
    return;
  }
  if (Platform.OS === 'web') {
    await downloadOnWeb(uri, options.fileName, options.mimeType);
    return;
  }
  throw new ReceiptShareUnavailableError();
}

/** Capture the on-screen receipt view as a PNG at native pixel density. */
export async function captureReceiptPng(
  viewRef: RefObject<View | null>,
  fileName = 'p2p-receipt',
): Promise<string> {
  if (!viewRef.current) {
    throw new Error('Receipt view is not ready to capture.');
  }
  return captureRef(viewRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: safeFileName(fileName),
  });
}

/** Share the captured receipt as a PNG (Save Image / share sheet / web download). */
export async function saveReceiptAsImage(
  viewRef: RefObject<View | null>,
  fileName = 'p2p-receipt',
): Promise<void> {
  const base = safeFileName(fileName);
  const uri = await captureReceiptPng(viewRef, base);
  await shareOrDownload(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Save as image',
    UTI: 'public.png',
    fileName: `${base}.png`,
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
  const base = safeFileName(fileName);
  const imageUri = await captureReceiptPng(viewRef, base);
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
  await shareOrDownload(pdf.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save as PDF',
    UTI: 'com.adobe.pdf',
    fileName: `${base}.pdf`,
  });
}

/** PDF from structured receipt data (no view capture — reliable on web and native). */
export async function saveReceiptContentAsPdf(
  content: ReceiptContent,
  fileName = 'p2p-receipt',
): Promise<void> {
  const base = safeFileName(fileName);
  const pdf = await Print.printToFileAsync({
    html: buildReceiptHtml(content),
    width: PDF_PAGE_WIDTH,
  });
  await shareOrDownload(pdf.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save as PDF',
    UTI: 'com.adobe.pdf',
    fileName: `${base}.pdf`,
  });
}

/**
 * Image save: prefer capturing the on-screen view; if that fails (common on web /
 * design overlays), fall back to an HTML → PNG path on web or HTML → PDF share.
 */
export async function saveReceiptContentAsImage(
  content: ReceiptContent,
  fileName = 'p2p-receipt',
  viewRef?: RefObject<View | null>,
): Promise<void> {
  const base = safeFileName(fileName);
  if (viewRef?.current) {
    try {
      await saveReceiptAsImage(viewRef, base);
      return;
    } catch {
      // Fall through to content-based export.
    }
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const uri = await renderReceiptPngOnWeb(content);
    await shareOrDownload(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Save as image',
      UTI: 'public.png',
      fileName: `${base}.png`,
    });
    return;
  }
  // Native without a capturable view: ship a PDF the user can open/save.
  await saveReceiptContentAsPdf(content, base);
}

/** Canvas receipt for web when view-shot / share sheet is unavailable. */
async function renderReceiptPngOnWeb(content: ReceiptContent): Promise<string> {
  const rows = normalizeRows(content.rows);
  const pad = 24;
  const width = 390;
  const lineGap = 8;
  const scale = 2;

  let y = pad;
  y += 36 + 16;
  y += 16;
  y += rows.length * (22 + lineGap);
  y += 12 + 1 + 12;
  if (content.status) y += 22 + 4;
  if (content.note) y += 20 + 4;
  if (content.when) y += 20 + 4;
  y += 16;
  if (content.steps?.length) {
    y += 12 + 18 + 8 + 20 + content.steps.length * 22 + 16;
  }
  y += pad;
  const height = Math.max(y, 200);

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not render receipt image.');
  ctx.scale(scale, scale);

  const roundRect = (x: number, yy: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, yy);
    ctx.arcTo(x + w, yy, x + w, yy + h, r);
    ctx.arcTo(x + w, yy + h, x, yy + h, r);
    ctx.arcTo(x, yy + h, x, yy, r);
    ctx.arcTo(x, yy, x + w, yy, r);
    ctx.closePath();
  };

  ctx.fillStyle = '#F3F6F4';
  ctx.fillRect(0, 0, width, height);

  let cursor = pad;
  ctx.fillStyle = '#0E1F19';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText(content.title || 'Receipt', pad, cursor + 26);
  cursor += 36 + 16;

  const cardTop = cursor;
  let cardInner = cursor + 16;
  cardInner += rows.length * (22 + lineGap);
  cardInner += 12 + 1 + 12;
  if (content.status) cardInner += 22 + 4;
  if (content.note) cardInner += 20 + 4;
  if (content.when) cardInner += 20 + 4;
  cardInner += 16;
  const cardHeight = cardInner - cardTop;

  ctx.fillStyle = '#FFFFFF';
  roundRect(pad, cardTop, width - pad * 2, cardHeight, 18);
  ctx.fill();

  let rowY = cardTop + 16 + 16;
  for (const row of rows) {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#33453D';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, pad + 14, rowY);
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillStyle = '#0E1F19';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, width - pad - 14, rowY, width / 2 - 20);
    rowY += 22 + lineGap;
  }
  ctx.textAlign = 'left';
  rowY += 4;
  ctx.fillStyle = '#DDE4E0';
  ctx.fillRect(pad + 14, rowY, width - pad * 2 - 28, 1);
  rowY += 16;
  if (content.status) {
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#0B6E4F';
    ctx.fillText(content.status, pad + 14, rowY);
    rowY += 22 + 4;
  }
  if (content.note) {
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#33453D';
    ctx.fillText(content.note, pad + 14, rowY, width - pad * 2 - 28);
    rowY += 20 + 4;
  }
  if (content.when) {
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#46574F';
    ctx.fillText(content.when, pad + 14, rowY, width - pad * 2 - 28);
  }

  cursor = cardTop + cardHeight + 12;
  if (content.steps?.length) {
    const stepsHeight = 18 + 8 + 20 + content.steps.length * 22 + 16;
    ctx.fillStyle = '#FFFFFF';
    roundRect(pad, cursor, width - pad * 2, stepsHeight, 18);
    ctx.fill();
    let sy = cursor + 22;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#5B6B64';
    ctx.fillText('PROGRESS', pad + 14, sy);
    sy += 22;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#0E1F19';
    ctx.fillText('Requested', pad + 14, sy);
    sy += 22;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#33453D';
    for (const step of content.steps) {
      ctx.fillText(step, pad + 14, sy, width - pad * 2 - 28);
      sy += 22;
    }
  }

  return canvas.toDataURL('image/png');
}
