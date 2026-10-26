import { router } from 'expo-router';
import { ScanFace } from 'lucide-react-native';

import { useToast } from '@/providers/ToastProvider';
import { kycApi } from '@/services/api/kycApi';
import { useAppDispatch } from '@/store';

import { CaptureFlow } from '../components/CaptureFlow';

/**
 * Live photo for ComplyCube identity_check. Captured on-device (front camera only — no library)
 * and uploaded as the provider live photo. Device-side challenge liveness (blink/turn) is still
 * pending a native SDK; this step is required for live identity verification.
 */
export function SelfieScreen() {
  const toast = useToast();
  const dispatch = useAppDispatch();

  const onUploaded = async () => {
    toast.show({ type: 'success', title: 'Live photo saved' });
    const progress = await dispatch(
      kycApi.endpoints.getKycProgress.initiate(undefined, { forceRefetch: true, subscribe: false }),
    );
    router.replace(progress.data?.hasDocument ? '/kyc/submit' : '/kyc');
  };

  return (
    <CaptureFlow
      kind="selfie"
      target={{ kind: 'selfie' }}
      icon={ScanFace}
      title="Live photo"
      subtitle="We'll match this live photo of your face with the photo on your identity document."
      tips={[
        'Use the front camera now — not a saved photo from your gallery.',
        'Find good, even lighting — face a window or lamp.',
        'Remove glasses, hats and anything covering your face.',
        'Look straight at the camera with a neutral expression.',
      ]}
      cameraHint="Position your face inside the oval"
      allowLibrary={false}
      onUploaded={() => void onUploaded()}
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/kyc'))}
    />
  );
}
