import * as Clipboard from 'expo-clipboard';

import { digitsFromPasteEvent, extractDigits, readDigitsFromClipboard } from '../pasteDigits';

describe('extractDigits', () => {
  it('strips separators and respects max length', () => {
    expect(extractDigits('123-456', 6)).toBe('123456');
    expect(extractDigits('Code: 12 34 56', 6)).toBe('123456');
    expect(extractDigits('9876543210', 4)).toBe('9876');
    expect(extractDigits('', 6)).toBe('');
    expect(extractDigits(null, 6)).toBe('');
  });

  it('prefers a contiguous OTP-sized run from email copy', () => {
    const email =
      'Verification code\n847291\nThe code expires in 10 minutes. Don’t share it.';
    expect(extractDigits(email, 6)).toBe('847291');
  });

  it('normalizes fullwidth digits from HTML email clients', () => {
    expect(extractDigits('１２３４５６', 6)).toBe('123456');
  });

  it('strips zero-width characters between digits from HTML email copy', () => {
    expect(extractDigits('8\u200B4\u200B7\u200B2\u200B9\u200B1', 6)).toBe('847291');
  });
});

describe('digitsFromPasteEvent', () => {
  it('reads text/plain from a paste event', () => {
    const event = {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'Code 551122' : ''),
      },
    };
    expect(digitsFromPasteEvent(event, 6)).toBe('551122');
  });
});

describe('readDigitsFromClipboard', () => {
  it('reads and sanitizes clipboard contents', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce('PIN 4821');
    await expect(readDigitsFromClipboard(4)).resolves.toBe('4821');
  });

  it('returns empty when clipboard has no digits', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce('hello');
    await expect(readDigitsFromClipboard(6)).resolves.toBe('');
  });
});
