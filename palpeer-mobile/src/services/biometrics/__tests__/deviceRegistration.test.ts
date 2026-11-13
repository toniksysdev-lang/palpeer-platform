import { isSamePhoneAsOthers } from '../deviceRegistration';
import type { DeviceResponse } from '@/types/api/security';

function device(
  id: string,
  identifier: string,
  platform = 'android',
  deviceName = 'Pixel 8',
): DeviceResponse {
  return {
    id,
    deviceIdentifier: identifier,
    platform,
    deviceName,
    enabled: true,
    lastUsedAt: null,
  };
}

describe('isSamePhoneAsOthers', () => {
  it('is true when there are no other enabled devices', () => {
    expect(isSamePhoneAsOthers([device('1', 'hw:a')], 'hw:a', 'android', 'Pixel 8')).toBe(true);
  });

  it('treats a single other android row as the same phone after reinstall', () => {
    expect(
      isSamePhoneAsOthers(
        [device('old', 'uuid-old', 'android', 'Pixel 8')],
        'hw:new',
        'android',
        'Pixel 8',
      ),
    ).toBe(true);
  });

  it('does not treat a single ios row as the same android phone', () => {
    expect(
      isSamePhoneAsOthers(
        [device('old', 'uuid-old', 'ios', 'iPhone')],
        'hw:new',
        'android',
        'Pixel 8',
      ),
    ).toBe(false);
  });
});
