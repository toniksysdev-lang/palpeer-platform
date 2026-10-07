import { router, useLocalSearchParams } from 'expo-router';
import { IdCard } from 'lucide-react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState } from '@/components/feedback/StateViews';
import { useToast } from '@/providers/ToastProvider';
import { kycApi } from '@/services/api/kycApi';
import { useAppDispatch } from '@/store';

import { CaptureFlow } from '../components/CaptureFlow';
import { documentTypeLabel, isKycDocumentType, KYC_DOCUMENT_TYPES } from '../kycState';

export function DocumentCaptureScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const toast = useToast();
  const dispatch = useAppDispatch();

  if (!isKycDocumentType(type)) {
    return (
      <Screen>
        <StackHeader />
        <EmptyState
          icon={IdCard}
          title="Choose a document type"
          message="Pick which document you're photographing first."
          actionLabel="Choose document"
          onAction={() => router.replace('/kyc/document-type')}
        />
      </Screen>
    );
  }

  const meta = KYC_DOCUMENT_TYPES.find((item) => item.value === type);

  const onUploaded = async () => {
    toast.show({ type: 'success', title: `${documentTypeLabel(type)} uploaded` });
    const progress = await dispatch(
      kycApi.endpoints.getKycProgress.initiate(undefined, { forceRefetch: true, subscribe: false }),
    );
    router.replace(progress.data && !progress.data.hasSelfie ? '/kyc/selfie' : '/kyc');
  };

  return (
    <CaptureFlow
      kind="document"
      target={{ kind: 'document', documentType: type }}
      icon={IdCard}
      title={`Photograph your ${documentTypeLabel(type).toLowerCase()}`}
      subtitle={meta?.hint ?? ''}
      tips={[
        'Place the document on a dark, flat surface.',
        'Fit all four corners inside the frame.',
        'Avoid glare, shadows and blur — the text must be readable.',
      ]}
      cameraHint="Fit the document inside the frame"
      allowLibrary
      onUploaded={() => void onUploaded()}
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/kyc'))}
      notice="Your photo is sent securely and used only to verify your identity."
    />
  );
}
