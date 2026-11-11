import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';

import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { logger } from '@/utils/logger';

import { kycErrorMessage } from '../errors';
import {
  ImageQualityError,
  prepareImage,
  type CapturedImage,
  type ImageKind,
  type PreparedImage,
} from '../image';
import { useKycUpload, type KycUploadTarget } from '../useKycUpload';
import { CameraCapture } from './CameraCapture';
import { DesignKycShell } from './DesignKycShell';
import { KYC_D as D } from './designTokens';

type Props = {
  kind: ImageKind;
  target: KycUploadTarget;
  title: string;
  subtitle: string;
  tips: string[];
  cameraHint: string;
  /** Selfies must be taken live; documents may also come from the photo library. */
  allowLibrary: boolean;
  /** Skip intro and open the camera or library picker immediately. */
  autoStart?: 'camera' | 'library';
  onUploaded: () => void;
  onExit: () => void;
  icon?: LucideIcon;
  notice?: string;
};

type Phase =
  | { name: 'intro'; warning?: string }
  | { name: 'camera' }
  | { name: 'processing' }
  | { name: 'review'; image: PreparedImage };

export function CaptureFlow({
  kind,
  target,
  title,
  subtitle,
  tips,
  cameraHint,
  allowLibrary,
  autoStart,
  onUploaded,
  onExit,
  notice,
}: Props) {
  useSensitiveScreen();
  const [phase, setPhase] = useState<Phase>(() =>
    autoStart === 'camera' ? { name: 'camera' } : { name: 'intro' },
  );
  const { state: upload, upload: send, reset } = useKycUpload(target);
  const autoLibraryStarted = useRef(false);

  const process = async (source: CapturedImage) => {
    setPhase({ name: 'processing' });
    try {
      const image = await prepareImage(source, kind);
      setPhase({ name: 'review', image });
    } catch (error) {
      if (error instanceof ImageQualityError) {
        setPhase({ name: 'intro', warning: error.message });
      } else {
        logger.warn('Image processing failed', { error });
        setPhase({
          name: 'intro',
          warning: "We couldn't read that photo. Please try another one.",
        });
      }
    }
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) {
        setPhase({ name: 'intro' });
        return;
      }
      // Library assets can omit size on web; prepareImage measures the file before quality checks.
      await process({
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
    } catch (error) {
      logger.warn('Image library failed', { error });
      setPhase({
        name: 'intro',
        warning: "We couldn't open your photos. Try taking a photo instead.",
      });
    }
  };

  useEffect(() => {
    if (autoStart !== 'library' || autoLibraryStarted.current || !allowLibrary) return;
    autoLibraryStarted.current = true;
    void pickFromLibrary();
    // Intentionally once on mount when opened via “Upload image”.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount auto-start only
  }, [autoStart, allowLibrary]);

  const retake = () => {
    reset();
    setPhase({ name: 'intro' });
  };

  const submit = async (image: PreparedImage) => {
    const ok = await send(image);
    if (ok) onUploaded();
  };

  if (phase.name === 'camera') {
    return (
      <CameraCapture
        facing={kind === 'selfie' ? 'front' : 'back'}
        overlay={kind === 'selfie' ? 'face' : 'document'}
        hint={cameraHint}
        onCaptured={process}
        onCancel={() => setPhase({ name: 'intro' })}
        onUseLibrary={allowLibrary ? pickFromLibrary : undefined}
      />
    );
  }

  if (phase.name === 'processing') {
    return (
      <DesignKycShell
        onBack={onExit}
        title="Checking your photo"
        subtitle="One moment…"
        centered
        testID="capture-processing"
      >
        <ActivityIndicator color={D.green} size="large" />
      </DesignKycShell>
    );
  }

  if (phase.name === 'review') {
    const { image } = phase;
    const uploading = upload.status === 'uploading';
    const failed = upload.status === 'error' ? upload.error : null;
    const notAllowed = failed?.code === 'KYC_UPLOAD_NOT_ALLOWED';
    const footer = notAllowed
      ? [{ label: 'Back', onPress: onExit, testID: 'capture-exit' }]
      : [
          {
            label: failed ? 'Try again' : 'Use this photo',
            onPress: () => void submit(image),
            loading: uploading,
            disabled: uploading,
            testID: 'capture-upload',
          },
          {
            label: 'Retake',
            onPress: retake,
            variant: 'ghost' as const,
            disabled: uploading,
            testID: 'capture-retake',
          },
        ];

    return (
      <DesignKycShell
        onBack={uploading ? () => undefined : retake}
        title="Check your photo"
        subtitle={
          kind === 'document'
            ? 'Make sure all four corners are visible, and the text is sharp with no glare.'
            : 'Make sure your whole face is visible, in focus and well lit.'
        }
        footer={footer}
      >
        <Image
          source={{ uri: image.uri }}
          accessibilityLabel={kind === 'document' ? 'Photo of your document' : 'Your selfie'}
          resizeMode="contain"
          style={{
            width: '100%',
            aspectRatio: image.width > 0 && image.height > 0 ? image.width / image.height : 1,
            maxHeight: 420,
            borderRadius: 18,
            backgroundColor: D.field,
          }}
          testID="capture-preview"
        />
        {uploading ? (
          <Text style={styles.meta}>Uploading {Math.round(upload.progress * 100)}%</Text>
        ) : null}
        {failed ? (
          <Text style={styles.error} testID="capture-error" accessibilityRole="alert">
            {kycErrorMessage(failed)}
          </Text>
        ) : null}
      </DesignKycShell>
    );
  }

  const footer = [
    {
      label: 'Take photo',
      onPress: () => setPhase({ name: 'camera' }),
      testID: 'capture-camera',
    },
    ...(allowLibrary
      ? [
          {
            label: 'Upload image',
            onPress: () => void pickFromLibrary(),
            variant: 'secondary' as const,
            testID: 'capture-library',
          },
        ]
      : []),
  ];

  return (
    <DesignKycShell
      onBack={onExit}
      title={title}
      subtitle={subtitle}
      listenText={[title, subtitle, ...tips, notice].filter(Boolean).join('. ')}
      footer={footer}
    >
      {phase.warning ? (
        <Text style={styles.warn} testID="capture-warning" accessibilityRole="alert">
          {phase.warning}
        </Text>
      ) : null}
      <View style={styles.tipsCard}>
        {tips.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <CheckCircle2 color={D.green} size={20} strokeWidth={2.4} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </DesignKycShell>
  );
}

const styles = StyleSheet.create({
  tipsCard: {
    backgroundColor: D.white,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.ink,
    lineHeight: 22,
  },
  notice: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 14,
    fontWeight: '600',
    color: D.muted,
    lineHeight: 20,
  },
  warn: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 22,
  },
  error: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 22,
  },
  meta: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '600',
    color: D.secondary,
  },
});
