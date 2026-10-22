import { createRef } from 'react';
import { Image, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  ReceiptShareUnavailableError,
  saveReceiptAsImage,
  saveReceiptAsPdf,
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
    const ref = createRef<View>();
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
    const ref = createRef<View>();
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

  it('fails clearly when sharing is unavailable', async () => {
    isAvailableMock.mockResolvedValue(false);
    await expect(saveReceiptAsImage(createRef<View>())).rejects.toBeInstanceOf(
      ReceiptShareUnavailableError,
    );
    expect(captureRefMock).not.toHaveBeenCalled();
  });
});
