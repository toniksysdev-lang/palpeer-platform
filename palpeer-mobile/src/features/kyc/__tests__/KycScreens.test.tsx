import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { fail, installFetchMock, ok } from '@/tests/fetchMock';
import { router } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { DocumentTypeScreen } from '../screens/DocumentTypeScreen';
import { KycHubScreen } from '../screens/KycHubScreen';
import { KycSubmitScreen } from '../screens/KycSubmitScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

const emptyProfile = {
  id: 'p-1',
  userId: 'u-1',
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  countryOfResidence: null,
  stateTerritory: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  postalCode: null,
  sourceOfIncome: null,
  monthlyTransactionEstimate: null,
  complete: false,
};

function kycRoutes(
  status: Status,
  progress: Partial<{
    hasDocument: boolean;
    hasSelfie: boolean;
    documentTypes: string[];
  }> = {},
  rejectionReason: string | null = null,
) {
  const hasDocument = progress.hasDocument ?? false;
  const documentTypes =
    progress.documentTypes ?? (hasDocument ? ['PASSPORT'] : []);
  return {
    'GET /profiles/me': ok(emptyProfile),
    'GET /kyc/status': ok({
      caseId: 'c-1',
      userId: 'u-1',
      status,
      rejectionReason,
      createdAt: null,
      updatedAt: null,
    }),
    'GET /kyc/progress': ok({
      caseId: 'c-1',
      status,
      hasDocument,
      documentCount: hasDocument ? Math.max(1, documentTypes.length) : 0,
      hasSelfie: false,
      selfieCount: progress.hasSelfie ? 1 : 0,
      documentTypes,
      ...progress,
    }),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: 'u-1', accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    'ada@example.com',
  );
});

describe('KycHubScreen', () => {
  it('starts with the document step', async () => {
    installFetchMock(kycRoutes('NOT_STARTED'));
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByText('Live identity verification')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kyc-next'));
    expect(router.push).toHaveBeenCalledWith('/kyc/document-type');
  });

  it('moves to the selfie and then submit as uploads land', async () => {
    installFetchMock(kycRoutes('IN_PROGRESS', { hasDocument: true, hasSelfie: true }));
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByText('Review and submit')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kyc-next'));
    expect(router.push).toHaveBeenCalledWith('/kyc/submit');
  });

  it('shows review in progress without upload steps', async () => {
    installFetchMock(kycRoutes('UNDER_REVIEW', { hasDocument: true, hasSelfie: true }));
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByText('Live check in progress')).toBeTruthy();
    expect(screen.getByTestId('kyc-check-again')).toBeTruthy();
    expect(screen.queryByTestId('kyc-step-document')).toBeNull();
    expect(screen.queryByTestId('kyc-next')).toBeNull();
  });

  it('shows the rejection reason and asks for a new document', async () => {
    installFetchMock(
      kycRoutes('REJECTED', { hasDocument: true, hasSelfie: true }, 'Document expired'),
    );
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByText('Reason: Document expired')).toBeTruthy();
    expect(screen.getByText('Upload a new document')).toBeTruthy();
  });

  it('shows the verified state', async () => {
    installFetchMock(kycRoutes('APPROVED', { hasDocument: true, hasSelfie: true }));
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByText("You're verified")).toBeTruthy();
    expect(screen.queryByTestId('kyc-next')).toBeNull();
  });

  it('recovers from a failed load', async () => {
    const routes = kycRoutes('NOT_STARTED');
    installFetchMock({
      'GET /profiles/me': routes['GET /profiles/me'],
      'GET /kyc/status': [fail(500, 'INTERNAL_ERROR'), routes['GET /kyc/status']],
      'GET /kyc/progress': routes['GET /kyc/progress'],
    });
    await renderWithProviders(<KycHubScreen />);

    await fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('Live identity verification')).toBeTruthy();
  });

  it('prompts to complete personal information when the profile is incomplete', async () => {
    installFetchMock(kycRoutes('NOT_STARTED'));
    await renderWithProviders(<KycHubScreen />);

    expect(await screen.findByTestId('kyc-profile-prompt')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kyc-profile-prompt'));
    expect(router.push).toHaveBeenCalledWith('/profile/personal');
  });
});

describe('DocumentTypeScreen', () => {
  it('marks uploaded document types', async () => {
    installFetchMock(
      kycRoutes('IN_PROGRESS', {
        hasDocument: true,
        documentTypes: ['DRIVING_LICENSE', 'PASSPORT'],
      }),
    );
    await renderWithProviders(<DocumentTypeScreen />);

    expect(await screen.findByTestId('doc-type-uploaded-DRIVING_LICENSE')).toBeTruthy();
    expect(screen.getByTestId('doc-type-uploaded-PASSPORT')).toBeTruthy();
    expect(screen.queryByTestId('doc-type-uploaded-NATIONAL_ID')).toBeNull();
    expect(screen.getByText('Front of the card')).toBeTruthy();
  });

  it('navigates to capture for a chosen type', async () => {
    installFetchMock(kycRoutes('NOT_STARTED'));
    await renderWithProviders(<DocumentTypeScreen />);

    await fireEvent.press(await screen.findByTestId('doc-type-NATIONAL_ID'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/kyc/document',
      params: { type: 'NATIONAL_ID' },
    });
  });
});

describe('KycSubmitScreen', () => {
  async function fillNames() {
    await fireEvent.changeText(await screen.findByTestId('kyc-first-name'), ' Ada ');
    await fireEvent.changeText(screen.getByTestId('kyc-last-name'), 'Lovelace');
  }

  it('validates the form before calling the API', async () => {
    const { calls } = installFetchMock(kycRoutes('IN_PROGRESS', { hasDocument: true }));
    await renderWithProviders(<KycSubmitScreen />);

    await fireEvent.changeText(await screen.findByTestId('kyc-dob'), '1990-13-01');
    await fireEvent.press(screen.getByTestId('kyc-submit'));

    expect(await screen.findByText('Enter your first name')).toBeTruthy();
    expect(screen.getByText('Use the format YYYY-MM-DD, e.g. 1990-04-21')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('submits and returns to the verification page', async () => {
    const { calls } = installFetchMock({
      ...kycRoutes('IN_PROGRESS', { hasDocument: true, hasSelfie: true }),
      'POST /kyc/verification/start': ok({
        caseId: 'c-1',
        status: 'UNDER_REVIEW',
        providerName: 'complycube',
        providerClientId: 'x',
        providerCheckId: 'y',
      }),
    });
    await renderWithProviders(<KycSubmitScreen />);

    await fillNames();
    await fireEvent.changeText(screen.getByTestId('kyc-country'), 'ng');
    await fireEvent.press(screen.getByTestId('kyc-submit'));

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/kyc'));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      issuingCountry: 'NG',
    });
  });

  it('explains honestly when verification is switched off', async () => {
    installFetchMock({
      ...kycRoutes('IN_PROGRESS', { hasDocument: true, hasSelfie: true }),
      'POST /kyc/verification/start': fail(503, 'KYC_PROVIDER_DISABLED', 'Provider disabled'),
    });
    await renderWithProviders(<KycSubmitScreen />);

    await fillNames();
    await fireEvent.press(screen.getByTestId('kyc-submit'));

    expect(await screen.findByText(/Identity verification isn't available yet/)).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('points to the document step when no document is on file', async () => {
    installFetchMock(kycRoutes('IN_PROGRESS', { hasDocument: false }));
    await renderWithProviders(<KycSubmitScreen />);

    expect(await screen.findByTestId('kyc-submit-no-document')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add identity document'));
    expect(router.push).toHaveBeenCalledWith('/kyc/document-type');
  });

  it('does not offer the form once the case is under review', async () => {
    installFetchMock(kycRoutes('UNDER_REVIEW', { hasDocument: true, hasSelfie: true }));
    await renderWithProviders(<KycSubmitScreen />);

    expect(await screen.findByTestId('kyc-submit-closed')).toBeTruthy();
    expect(screen.queryByTestId('kyc-first-name')).toBeNull();
  });
});
