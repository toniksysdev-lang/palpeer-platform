import { redact } from '../logger';

describe('redact', () => {
  it('masks sensitive keys at any depth', () => {
    const result = redact({
      email: 'ada@example.com',
      password: 'hunter2',
      otp: '123456',
      code: '654321',
      pin: '0000',
      refreshToken: 'abc',
      nested: { accessToken: 'def', cvv: '123', cardNumber: '4111111111111111' },
    });
    expect(result).toEqual({
      email: 'ada@example.com',
      password: '[redacted]',
      otp: '[redacted]',
      code: '[redacted]',
      pin: '[redacted]',
      refreshToken: '[redacted]',
      nested: { accessToken: '[redacted]', cvv: '[redacted]', cardNumber: '[redacted]' },
    });
  });

  it('masks bearer tokens and JWTs inside strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(redact(`Authorization: Bearer ${jwt}`)).toBe('Authorization: Bearer [redacted]');
    expect(redact(`token=${jwt}`)).toBe('token=[redacted]');
  });

  it('serialises errors without leaking secrets', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(redact(new Error(`failed with ${jwt}`))).toEqual({
      name: 'Error',
      message: 'failed with [redacted]',
    });
  });

  it('leaves non-sensitive values untouched', () => {
    expect(
      redact({ status: 403, path: '/wallets', items: [1, 2], company: 'Acme', shipping: 'x' }),
    ).toEqual({
      status: 403,
      path: '/wallets',
      items: [1, 2],
      company: 'Acme',
      shipping: 'x',
    });
    expect(redact({ newPin: '1234', currentPin: '0000' })).toEqual({
      newPin: '[redacted]',
      currentPin: '[redacted]',
    });
  });
});
