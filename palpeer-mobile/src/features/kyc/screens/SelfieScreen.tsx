import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ScanFace } from 'lucide-react-native';

import { useToast } from '@/providers/ToastProvider';
import { kycApi } from '@/services/api/kycApi';
import { useAppDispatch } from '@/store';

import { CaptureFlow } from '../components/CaptureFlow';
import { kycHref, safeKycReturnTo } from '../returnTo';

/**
 * Live photo for ComplyCube identity_check. Captured on-device (front camera only — no library)
 * and uploaded as the provider live photo. Device-side challenge liveness (blink/turn) is still
 * pending a native SDK; this step is required for live identity verification.
 */
export function SelfieScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeKycReturnTo(returnToParam, '');
  const toast = useToast();
  const dispatch = useAppDispatch();

  const onUploaded = async () => {
    toast.show({ type: 'success', title: 'Live photo saved' });
    const progress = await dispatch(
      kycApi.endpoints.getKycProgress.initiate(undefined, { forceRefetch: true, subscribe: false }),
    );
    // Design profile flow: Show my ID (agree + Send to Palpeer) instead of the legacy form.
    if (returnTo === '/StartChecking' && progress.data?.hasDocument) {
      router.replace('/StartKyc' as Href);
      return;
    }
    if (progress.data?.hasDocument) {
      router.replace(kycHref('/kyc/submit', returnTo || undefined) as Href);
      return;
    }
    router.replace((returnTo || '/kyc') as Href);
  };

  return (
    <CaptureFlow
      kind="selfie"
      target={{ kind: 'selfie' }}
      icon={ScanFace}
      title="Live photo of my face"
      subtitle="Look at the camera. We'll match this live photo with the photo on your ID."
      tips={[
        'Use the front camera now — not a saved photo from your gallery.',
        'Keep your whole face and a little of your shoulders visible — don’t crop too close.',
        'Find good, even lighting — face a window or lamp.',
        'Remove glasses, hats and anything covering your face.',
        'Look straight at the camera with a neutral expression.',
      ]}
      cameraHint="Center your face in the oval — leave a little space around your head"
      allowLibrary={false}
      onUploaded={() => void onUploaded()}
      onExit={() =>
        router.canGoBack()
          ? router.back()
          : router.replace((returnTo || '/kyc') as Href)
      }
    />
  );
}
