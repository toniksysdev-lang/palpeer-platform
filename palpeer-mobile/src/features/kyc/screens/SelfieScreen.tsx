import { router } from 'expo-router';
import { ScanFace } from 'lucide-react-native';

import { useToast } from '@/providers/ToastProvider';
import { kycApi } from '@/services/api/kycApi';
import { useAppDispatch } from '@/store';

import { CaptureFlow } from '../components/CaptureFlow';

/**
 * Still-photo selfie. The backend stores it for the provider's photo check; the app performs no
 * liveness detection (LIVENESS_CONTRACT_PENDING) and never claims to.
 */
export function SelfieScreen() {
  const toast = useToast();
  const dispatch = useAppDispatch();

  const onUploaded = async () => {
    toast.show({ type: 'success', title: 'Selfie uploaded' });
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
      title="Take a selfie"
      subtitle="We'll compare it with the photo on your document."
      tips={[
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
