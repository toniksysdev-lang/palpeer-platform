import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { created, installFakeXhr, partValue } from '@/tests/fakeXhr';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';

import { uploadMultipart } from '../upload';

const tokens = (n: number) => ({
  userId: 'u-1',
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer' as const,
});

const FILE = { uri: 'file:///doc.jpg', name: 'document-1.jpg', mimeType: 'image/jpeg' };

describe('uploadMultipart', () => {
  beforeEach(async () => {
    await secureStorage.clearAll();
    await sessionManager.start(tokens(0), 'ada@example.com');
    installFetchMock({});
  });

  it('sends the fields and file with the bearer token and reports progress', async () => {
    const { requests } = installFakeXhr({ 'POST /kyc/documents': created({ id: 'd-1' }) });
    const progress: number[] = [];

    const result = await uploadMultipart<{ id: string }>('/kyc/documents', {
      fields: { documentType: 'PASSPORT' },
      file: FILE,
      onProgress: (value) => progress.push(value),
    });

    expect(result).toEqual({ ok: true, data: { id: 'd-1' }, message: null });
    expect(requests[0]?.headers.Authorization).toBe('Bearer access-0');
    expect(requests[0]?.headers['X-Request-Id']).toBeTruthy();
    expect(partValue(requests[0], 'documentType')).toBe('PASSPORT');
    expect(partValue(requests[0], 'file')).toBeDefined();
    expect(progress).toEqual([0.5, 1]);
  });

  it('refreshes an expired token once and retries the upload', async () => {
    const { calls } = installFetchMock({ 'POST /auth/refresh': ok(tokens(1)) });
    const { requests } = installFakeXhr({
      'POST /kyc/selfie': ({ headers }) =>
        headers.Authorization === 'Bearer access-1' ? created({ id: 's-1' }) : { status: 403 },
    });

    const result = await uploadMultipart('/kyc/selfie', { file: FILE });

    expect(result.ok).toBe(true);
    expect(requests.map((request) => request.headers.Authorization)).toEqual([
      'Bearer access-0',
      'Bearer access-1',
    ]);
    expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(1);
  });

  it('reports offline and timeout failures without throwing', async () => {
    installFakeXhr({ 'POST /kyc/selfie': ['network-error', 'timeout'] });

    const offline = await uploadMultipart('/kyc/selfie', { file: FILE });
    const timeout = await uploadMultipart('/kyc/selfie', { file: FILE });

    expect(!offline.ok && offline.error.kind).toBe('offline');
    expect(!timeout.ok && timeout.error.kind).toBe('timeout');
  });

  it('surfaces the backend error code', async () => {
    installFakeXhr({
      'POST /kyc/documents': fail(409, 'KYC_UPLOAD_NOT_ALLOWED', 'Upload not allowed'),
    });

    const result = await uploadMultipart('/kyc/documents', { file: FILE });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        kind: 'conflict',
        status: 409,
        code: 'KYC_UPLOAD_NOT_ALLOWED',
      });
    }
  });

  it('aborts the request when the signal fires', async () => {
    const { instances } = installFakeXhr({ 'POST /kyc/selfie': 'hang' });
    const controller = new AbortController();

    const pending = uploadMultipart('/kyc/selfie', { file: FILE, signal: controller.signal });
    controller.abort();
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(instances[0]?.aborted).toBe(true);
  });
});
