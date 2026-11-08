import { createRef } from 'react';
import { Image, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  ReceiptShareUnavailableError,
  buildReceiptHtml,
  saveReceiptAsImage,
  saveReceiptAsPdf,
  saveReceiptContentAsPdf,
} from '../saveReceipt';

const captureRefMock = captureRef as jest.MockedFunction<typeof captureRef>;
const shareAsyncMock = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;
const isAvailableMock = Sharing.isAvailableAsync as jest.MockedFunction<
  typeof Sharing.isAvailableAsync
>;
const printToFileMock = Print.printToFileAsync as jest.MockedFunction<typeof Print.printToFileAsync>;
const readAsStringMock = FileSystem.readAsStringAsync as jest.MockedFunction<
  typeof FileSystem.readAsStringAsync
>;

function refWithView(): React.RefObject<View | null> {
  const ref = createRef<View>();
  // @ts-expect-error test stub — captureRef only needs a truthy current
  ref.current = {};
  return ref;
}

beforeEach(() => {
  jest.clearAllMocks();
  isAvailableMock.mockResolvedValue(true);
  captureRefMock.mockResolvedValue('file:///tmp/p2p-receipt.png');
  shareAsyncMock.mockResolvedValue(undefined);
  printToFileMock.mockResolvedValue({
    uri: 'file:///tmp/p2p-receipt.pdf',
    numberOfPages: 1,
  });
  readAsStringMock.mockResolvedValue('abc123');
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
    success(400, 800);
  });
});

describe('saveReceipt', () => {
  it('captures the view as PNG and opens the share sheet for Save as Image', async () => {
    const ref = refWithView();
    await saveReceiptAsImage(ref, 'p2p-receipt-o-1');

    expect(captureRefMock).toHaveBeenCalledWith(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      fileName: 'p2p-receipt-o-1',
    });
    expect(shareAsyncMock).toHaveBeenCalledWith('file:///tmp/p2p-receipt.png', {
      mimeType: 'image/png',
      dialogTitle: 'Save as image',
      UTI: 'public.png',
    });
  });

  it('embeds the same captured PNG in a PDF sized to the image, then shares it', async () => {
    const ref = refWithView();
    await saveReceiptAsPdf(ref, 'p2p-receipt-o-1');

    expect(captureRefMock).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ format: 'png', result: 'tmpfile' }),
    );
    expect(readAsStringMock).toHaveBeenCalledWith('file:///tmp/p2p-receipt.png', {
      encoding: FileSystem.EncodingType.Base64,
    });
    expect(printToFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 612,
        height: 1224,
        html: expect.stringContaining('data:image/png;base64,abc123'),
      }),
    );
    expect(shareAsyncMock).toHaveBeenCalledWith('file:///tmp/p2p-receipt.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Save as PDF',
      UTI: 'com.adobe.pdf',
    });
  });

  it('fails clearly when sharing is unavailable on native', async () => {
    const original = Platform.OS;
    // @ts-expect-error test override
    Platform.OS = 'ios';
    isAvailableMock.mockResolvedValue(false);
    try {
      await expect(saveReceiptAsImage(refWithView())).rejects.toBeInstanceOf(
        ReceiptShareUnavailableError,
      );
      expect(captureRefMock).toHaveBeenCalled();
    } finally {
      // @ts-expect-error test override
      Platform.OS = original;
    }
  });

  it('builds a PDF from receipt content without capturing a view', async () => {
    await saveReceiptContentAsPdf(
      {
        title: 'Took out money',
        rows: [
          { label: 'I took out', value: '₦5,000' },
          { label: 'Bank', value: 'Kuda' },
          { label: 'Account number', value: '0123456789' },
        ],
        status: 'Done',
        note: 'The money moved.',
        when: 'Today, 6:55 pm',
      },
      'palpeer-withdrawal-1',
    );

    expect(captureRefMock).not.toHaveBeenCalled();
    expect(printToFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Took out money'),
      }),
    );
    expect(shareAsyncMock).toHaveBeenCalledWith('file:///tmp/p2p-receipt.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Save as PDF',
      UTI: 'com.adobe.pdf',
    });
  });

  it('escapes HTML in receipt content', () => {
    const html = buildReceiptHtml({
      title: 'A <script>',
      rows: [{ label: 'To', value: 'a&b' }],
    });
    expect(html).toContain('A &lt;script&gt;');
    expect(html).toContain('a&amp;b');
    expect(html).not.toContain('<script>');
  });
});
