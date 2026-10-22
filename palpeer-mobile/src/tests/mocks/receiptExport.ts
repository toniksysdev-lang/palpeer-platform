export const captureRef = jest.fn(async () => 'file:///tmp/p2p-receipt.png');
export const releaseCapture = jest.fn();
export default { captureRef, releaseCapture };

export const shareAsync = jest.fn(async () => undefined);
export const isAvailableAsync = jest.fn(async () => true);

export const printToFileAsync = jest.fn(async () => ({
  uri: 'file:///tmp/p2p-receipt.pdf',
  numberOfPages: 1,
}));

export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;
export const readAsStringAsync = jest.fn(async () => 'fake-base64');
