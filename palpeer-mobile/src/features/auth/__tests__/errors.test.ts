import { authErrorMessage } from '../errors';
import { createAppError } from '@/services/api/errors';

describe('authErrorMessage', () => {
  it('surfaces the username field message instead of generic Validation failed', () => {
    const error = createAppError('validation', {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      fieldErrors: {
        username: 'Username must be 3–32 letters, numbers, or underscores',
      },
    });
    expect(authErrorMessage(error)).toBe(
      'Username must be 3–32 letters, numbers, or underscores',
    );
  });

  it('maps INVALID_USERNAME to a clear username rule message', () => {
    const error = createAppError('validation', {
      status: 400,
      code: 'INVALID_USERNAME',
      message: 'bad username',
    });
    expect(authErrorMessage(error)).toMatch(/username/i);
  });
});
