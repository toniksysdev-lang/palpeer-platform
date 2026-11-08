import { destinationAccountRows } from '../destination';

describe('destinationAccountRows', () => {
  it('splits CAD EFT into institution, transit, and account', () => {
    expect(destinationAccountRows('CAD', '001:12345:6789012')).toEqual([
      ['Method', 'Bank transfer (EFT)'],
      ['Institution', '001'],
      ['Transit', '12345'],
      ['Account', '6789012'],
    ]);
  });

  it('shows Interac email and phone destinations', () => {
    expect(destinationAccountRows('CAD', 'me@example.com')).toEqual([
      ['Method', 'Interac e-Transfer'],
      ['Email', 'me@example.com'],
    ]);
    expect(destinationAccountRows('CAD', '+15551234567')).toEqual([
      ['Method', 'Interac e-Transfer'],
      ['Phone', '+15551234567'],
    ]);
  });

  it('shows NGN bank name when known, otherwise bank code', () => {
    expect(destinationAccountRows('NGN', '999057:0123456789', 'Kuda')).toEqual([
      ['Bank', 'Kuda'],
      ['Account number', '0123456789'],
    ]);
    expect(destinationAccountRows('NGN', '999057:0123456789')).toEqual([
      ['Bank', 'Bank 999057'],
      ['Account number', '0123456789'],
    ]);
  });

  it('falls back when the destination is missing', () => {
    expect(destinationAccountRows('NGN', null)).toEqual([['To', 'My bank']]);
  });
});
