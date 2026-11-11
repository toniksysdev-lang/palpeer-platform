import { router, useLocalSearchParams, type Href } from 'expo-router';
import { IdCard } from 'lucide-react-native';

import { useToast } from '@/providers/ToastProvider';
import { kycApi } from '@/services/api/kycApi';
import { useAppDispatch } from '@/store';

import { CaptureFlow } from '../components/CaptureFlow';
import { DesignKycShell } from '../components/DesignKycShell';
import { documentTypeLabel, isKycDocumentType, KYC_DOCUMENT_TYPES } from '../kycState';
import { kycHref, safeKycReturnTo } from '../returnTo';

export function DocumentCaptureScreen() {
  const { type, returnTo: returnToParam, start } = useLocalSearchParams<{
    type?: string;
    returnTo?: string;
    start?: string;
  }>();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const returnTo = safeKycReturnTo(returnToParam, '');
  const autoStart = start === 'camera' || start === 'library' ? start : undefined;

  if (!isKycDocumentType(type)) {
    return (
      <DesignKycShell
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace((returnTo || '/kyc') as Href)
        }
        title="Choose a document type"
        subtitle="Pick which document you're photographing first."
        centered
        footer={[
          {
            label: 'Choose document',
            onPress: () => router.replace('/kyc/document-type'),
          },
        ]}
      />
    );
  }

  const meta = KYC_DOCUMENT_TYPES.find((item) => item.value === type);

  const onUploaded = async () => {
    toast.show({ type: 'success', title: `${documentTypeLabel(type)} uploaded` });
    const progress = await dispatch(
      kycApi.endpoints.getKycProgress.initiate(undefined, { forceRefetch: true, subscribe: false }),
    );
    if (progress.data && !progress.data.hasSelfie) {
      router.replace(kycHref('/kyc/selfie', returnTo || undefined) as Href);
      return;
    }
    // Design flow: back to Show your ID (or legacy /kyc hub).
    if (returnTo === '/StartChecking') {
      router.replace('/StartKyc' as Href);
      return;
    }
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    router.replace('/kyc');
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
      autoStart={autoStart}
      onUploaded={() => void onUploaded()}
      onExit={() =>
        router.canGoBack()
          ? router.back()
          : router.replace((returnTo || '/kyc') as Href)
      }
      notice="Your photo is sent securely and used only to verify your identity with ComplyCube."
    />
  );
}
