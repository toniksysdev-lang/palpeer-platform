import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2, ImageIcon, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTheme } from '@/providers/ThemeProvider';
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

type Props = {
  kind: ImageKind;
  target: KycUploadTarget;
  title: string;
  subtitle: string;
  tips: string[];
  cameraHint: string;
  /** Selfies must be taken live; documents may also come from the photo library. */
  allowLibrary: boolean;
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
  onUploaded,
  onExit,
  icon = Camera,
  notice,
}: Props) {
  useSensitiveScreen();
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const { state: upload, upload: send, reset } = useKycUpload(target);

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
        setPhase((current) => (current.name === 'camera' ? { name: 'intro' } : current));
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
      <Screen>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}
          testID="capture-processing"
        >
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <AppText tone="secondary">Checking your photo...</AppText>
        </View>
      </Screen>
    );
  }

  if (phase.name === 'review') {
    const { image } = phase;
    const uploading = upload.status === 'uploading';
    const failed = upload.status === 'error' ? upload.error : null;
    const notAllowed = failed?.code === 'KYC_UPLOAD_NOT_ALLOWED';
    return (
      <Screen
        scroll
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            {notAllowed ? (
              <Button label="Back to verification" onPress={onExit} testID="capture-exit" />
            ) : (
              <Button
                label={failed ? 'Try again' : 'Use this photo'}
                onPress={() => void submit(image)}
                loading={uploading}
                disabled={uploading}
                testID="capture-upload"
              />
            )}
            <Button
              label="Retake"
              variant="ghost"
              leftIcon={RotateCcw}
              onPress={retake}
              disabled={uploading}
              testID="capture-retake"
            />
          </View>
        }
      >
        <StackHeader title="Check your photo" onBack={uploading ? () => undefined : retake} />
        <AppText tone="secondary">
          {kind === 'document'
            ? 'Make sure all four corners are visible, and the text is sharp with no glare.'
            : 'Make sure your whole face is visible, in focus and well lit.'}
        </AppText>
        <Image
          source={{ uri: image.uri }}
          accessibilityLabel={kind === 'document' ? 'Photo of your document' : 'Your selfie'}
          resizeMode="contain"
          style={{
            width: '100%',
            aspectRatio: image.width > 0 && image.height > 0 ? image.width / image.height : 1,
            maxHeight: 420,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surfaceMuted,
          }}
          testID="capture-preview"
        />
        {uploading ? (
          <View style={{ gap: theme.spacing.xs }}>
            <ProgressBar
              value={upload.progress}
              accessibilityLabel="Upload progress"
              testID="upload-progress"
            />
            <AppText variant="caption" tone="secondary">
              Uploading {Math.round(upload.progress * 100)}%
            </AppText>
          </View>
        ) : null}
        {failed ? <FormAlert message={kycErrorMessage(failed)} testID="capture-error" /> : null}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Take photo"
            leftIcon={Camera}
            onPress={() => setPhase({ name: 'camera' })}
            testID="capture-camera"
          />
          {allowLibrary ? (
            <Button
              label="Choose from library"
              variant="outline"
              leftIcon={ImageIcon}
              onPress={() => void pickFromLibrary()}
              testID="capture-library"
            />
          ) : null}
        </View>
      }
    >
      <StackHeader onBack={onExit} />
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size="lg" color={theme.colors.primary} />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="h1" accessibilityRole="header">
          {title}
        </AppText>
        <AppText tone="secondary">{subtitle}</AppText>
      </View>
      {phase.warning ? (
        <FormAlert tone="warning" message={phase.warning} testID="capture-warning" />
      ) : null}
      <Card variant="muted">
        <View style={{ gap: theme.spacing.md }}>
          {tips.map((tip) => (
            <View
              key={tip}
              style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}
            >
              <Icon icon={CheckCircle2} size="sm" color={theme.colors.primary} />
              <AppText style={{ flex: 1 }}>{tip}</AppText>
            </View>
          ))}
        </View>
      </Card>
      {notice ? (
        <AppText variant="caption" tone="muted">
          {notice}
        </AppText>
      ) : null}
    </Screen>
  );
}
