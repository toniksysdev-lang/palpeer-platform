import { errorFromResponse, isAppError, kindForStatus, toAppError } from '../errors';

describe('errorFromResponse', () => {
  it('treats a 403 without an envelope as an expired session', () => {
    const error = errorFromResponse(403, null, 'req-1');
    expect(error.kind).toBe('unauthorized');
    expect(error.requestId).toBe('req-1');
  });

  it('keeps a 403 with an envelope as forbidden', () => {
    const error = errorFromResponse(
      403,
      { success: false, message: 'KYC required', error: { code: 'FORBIDDEN' }, timestamp: '' },
      null,
    );
    expect(error.kind).toBe('forbidden');
    expect(error.message).toBe('KYC required');
    expect(error.code).toBe('FORBIDDEN');
  });

  it('maps validation violations to field errors, first message wins', () => {
    const error = errorFromResponse(
      400,
      {
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          violations: [
            { field: 'email', message: 'must be a well-formed email address' },
            { field: 'email', message: 'must not be blank' },
            { field: 'password', message: 'size must be between 8 and 128' },
          ],
        },
        timestamp: '',
      },
      null,
    );
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual({
      email: 'must be a well-formed email address',
      password: 'size must be between 8 and 128',
    });
  });

  it('never surfaces raw server messages for 5xx', () => {
    const error = errorFromResponse(
      500,
      { success: false, message: 'NullPointerException at ...', timestamp: '' },
      null,
    );
    expect(error.kind).toBe('server');
    expect(error.message).not.toContain('NullPointerException');
  });

  it('preserves business error messages on 502', () => {
    const error = errorFromResponse(
      502,
      {
        success: false,
        message: 'Name Enquiry request not satisfied.',
        error: { code: 'KUDA_NAME_ENQUIRY_FAILED' },
        timestamp: '',
      },
      null,
    );
    expect(error.kind).toBe('server');
    expect(error.code).toBe('KUDA_NAME_ENQUIRY_FAILED');
    expect(error.message).toBe('Name Enquiry request not satisfied.');
  });

  it('maps statuses to kinds', () => {
    expect(kindForStatus(404)).toBe('notFound');
    expect(kindForStatus(409)).toBe('conflict');
    expect(kindForStatus(422)).toBe('unprocessable');
    expect(kindForStatus(429)).toBe('rateLimited');
    expect(kindForStatus(503)).toBe('serviceUnavailable');
    expect(kindForStatus(502)).toBe('server');
  });

  it('normalises unknown values', () => {
    expect(isAppError(new Error('x'))).toBe(false);
    expect(toAppError('boom').kind).toBe('unknown');
  });
});
