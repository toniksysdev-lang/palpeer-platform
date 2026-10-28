import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { created, installFakeXhr, partValue } from '@/tests/fakeXhr';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { media, preventScreenCaptureAsync } from '@/tests/mocks/media';
import { renderWithProviders } from '@/tests/render';

import { DocumentCaptureScreen } from '../screens/DocumentCaptureScreen';
import { SelfieScreen } from '../screens/SelfieScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const progress = (overrides: Record<string, unknown> = {}) => ({
  caseId: 'c-1',
  status: 'IN_PROGRESS',
  hasDocument: true,
  documentCount: 1,
  hasSelfie: false,
  selfieCount: 0,
  ...overrides,
});

const DOCUMENT = {
  id: 'd-1',
  kycCaseId: 'c-1',
  documentType: 'PASSPORT',
  contentType: 'image/jpeg',
  originalFilename: 'document.jpg',
  sizeBytes: 1000,
};

async function pickFromLibrary(width = 3000, height = 4000) {
  media.library = { canceled: false, assets: [{ uri: 'file:///library.jpg', width, height }] };
  media.sizes['file:///library.jpg'] = { width, height };
  await fireEvent.press(await screen.findByTestId('capture-library'));
}

describe('KYC capture', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    media.reset();
    setSearchParams({});
    await secureStorage.clearAll();
    await sessionManager.start(
      { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
      'ada@example.com',
    );
  });

  it('asks for a document type when the route param is missing or invalid', async () => {
    installFetchMock({});
    setSearchParams({ type: 'LIBRARY_CARD' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await fireEvent.press(screen.getByText('Choose document'));
    expect(router.replace).toHaveBeenCalledWith('/kyc/document-type');
  });

  it('blocks screenshots during capture', async () => {
    installFetchMock({});
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);
    await waitFor(() => expect(preventScreenCaptureAsync).toHaveBeenCalled());
  });

  it('asks for a retake when the photo is too small, without uploading', async () => {
    installFetchMock({});
    const { requests } = installFakeXhr({});
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await pickFromLibrary(120, 90);

    expect(await screen.findByTestId('capture-warning')).toBeTruthy();
    expect(screen.getByText(/This photo is too small to read/)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('keeps the user in place when they cancel the library picker', async () => {
    installFetchMock({});
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await fireEvent.press(await screen.findByTestId('capture-library'));

    expect(screen.getByTestId('capture-camera')).toBeTruthy();
    expect(screen.queryByTestId('capture-preview')).toBeNull();
  });

  it('retries the same photo after an upload failure, then moves on to the selfie', async () => {
    installFetchMock({ 'GET /kyc/progress': ok(progress()) });
    const { requests } = installFakeXhr({
      'POST /kyc/documents': [
        fail(500, 'STORAGE_WRITE_FAILED', 'Could not store file'),
        created(DOCUMENT),
      ],
    });
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await pickFromLibrary();
    expect(await screen.findByTestId('capture-preview')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('capture-upload'));
    expect(await screen.findByText("We couldn't save your photo. Please try again.")).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('capture-upload'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/kyc/selfie'));
    expect(requests).toHaveLength(2);
    expect(partValue(requests[1], 'documentType')).toBe('PASSPORT');
    expect(requests[0]?.headers.Authorization).toBe('Bearer access-0');
    expect(await screen.findByText('Passport uploaded')).toBeTruthy();
  });

  it('explains an offline failure and lets the user retry', async () => {
    installFetchMock({ 'GET /kyc/progress': ok(progress({ hasSelfie: true })) });
    installFakeXhr({ 'POST /kyc/documents': ['network-error', created(DOCUMENT)] });
    setSearchParams({ type: 'NATIONAL_ID' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await pickFromLibrary();
    await fireEvent.press(await screen.findByTestId('capture-upload'));
    expect(await screen.findByText(/You're offline/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('capture-upload'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/kyc'));
  });

  it('sends the user back when uploads are closed', async () => {
    installFetchMock({});
    installFakeXhr({
      'POST /kyc/documents': fail(409, 'KYC_UPLOAD_NOT_ALLOWED', 'Upload not allowed'),
    });
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await pickFromLibrary();
    await fireEvent.press(await screen.findByTestId('capture-upload'));

    expect(await screen.findByText(/already being reviewed or is complete/)).toBeTruthy();
    expect(screen.queryByTestId('capture-upload')).toBeNull();
    await fireEvent.press(screen.getByTestId('capture-exit'));
    expect(router.replace).toHaveBeenCalledWith('/kyc');
  });

  it('lets the user retake instead of uploading', async () => {
    installFetchMock({});
    const { requests } = installFakeXhr({});
    setSearchParams({ type: 'PASSPORT' });
    await renderWithProviders(<DocumentCaptureScreen />);

    await pickFromLibrary();
    await fireEvent.press(await screen.findByTestId('capture-retake'));

    expect(screen.getByTestId('capture-camera')).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('takes a selfie with the front camera only and continues to submit', async () => {
    installFetchMock({ 'GET /kyc/progress': ok(progress({ hasSelfie: true, selfieCount: 1 })) });
    const { requests } = installFakeXhr({ 'POST /kyc/selfie': created({ id: 's-1' }) });
    await renderWithProviders(<SelfieScreen />);

    expect(screen.queryByTestId('capture-library')).toBeNull();
    await fireEvent.press(screen.getByTestId('capture-camera'));
    expect(await screen.findByTestId('mock-camera-front')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('camera-shutter'));
    await fireEvent.press(await screen.findByTestId('capture-upload'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/kyc/submit'));
    expect(requests[0]?.path).toBe('/kyc/selfie');
  });
});
