import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Camera, CameraOff, ImageIcon, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/providers/ThemeProvider';
import { logger } from '@/utils/logger';

import type { CapturedImage } from '../image';

type Props = {
  facing: CameraType;
  overlay: 'document' | 'face';
  hint: string;
  onCaptured: (image: CapturedImage) => void;
  onCancel: () => void;
  /** Offered when the camera can't be used (denied, unavailable). */
  onUseLibrary?: () => void;
};

/**
 * Permission-aware camera. Permission is requested only when the user chooses to take a photo,
 * never on mount of an unrelated screen.
 */
export function CameraCapture({
  facing,
  overlay,
  hint,
  onCaptured,
  onCancel,
  onUseLibrary,
}: Props) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [mountError, setMountError] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);

  if (!permission) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <Screen>
        <StackHeader onBack={onCancel} />
        <View style={styles.center} testID="camera-permission">
          <EmptyState
            icon={CameraOff}
            title={blocked ? 'Camera access is off' : 'Allow camera access'}
            message={
              blocked
                ? 'Turn on camera access for PALPEER in your phone settings to take this photo.'
                : 'PALPEER needs your camera to photograph your ID and take a selfie. Photos are only used for identity verification.'
            }
          />
          <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
            {blocked ? (
              <Button
                label="Open settings"
                onPress={() => {
                  Linking.openSettings().catch((error: unknown) =>
                    logger.warn('Could not open settings', { error }),
                  );
                }}
                testID="camera-open-settings"
              />
            ) : (
              <Button
                label="Allow camera"
                onPress={() => {
                  requestPermission().catch((error: unknown) =>
                    logger.warn('Camera permission request failed', { error }),
                  );
                }}
                testID="camera-allow"
              />
            )}
            {onUseLibrary ? (
              <Button
                label="Choose from library instead"
                variant="ghost"
                onPress={onUseLibrary}
                testID="camera-use-library"
              />
            ) : null}
          </View>
        </View>
      </Screen>
    );
  }

  if (mountError) {
    return (
      <Screen>
        <StackHeader onBack={onCancel} />
        <View style={styles.center} testID="camera-unavailable">
          <EmptyState
            icon={CameraOff}
            title="Camera unavailable"
            message="We couldn't start the camera. Close other apps using it and try again."
          />
          <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
            <Button label="Try again" variant="outline" onPress={() => setMountError(false)} />
            {onUseLibrary ? (
              <Button label="Choose from library instead" variant="ghost" onPress={onUseLibrary} />
            ) : null}
          </View>
        </View>
      </Screen>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || !ready || capturing) return;
    setCapturing(true);
    setCaptureFailed(false);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
      onCaptured({ uri: picture.uri, width: picture.width, height: picture.height });
    } catch (error) {
      logger.warn('Camera capture failed', { error });
      setCaptureFailed(true);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.fill} testID="camera-view">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mirror={facing === 'front'}
        onCameraReady={() => setReady(true)}
        onMountError={({ message }) => {
          logger.warn('Camera mount error', { message });
          setMountError(true);
        }}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View
          style={
            overlay === 'face'
              ? [styles.faceFrame, { borderColor: theme.colors.onPrimary }]
              : [
                  styles.documentFrame,
                  { borderColor: theme.colors.onPrimary, borderRadius: theme.radius.lg },
                ]
          }
        />
      </View>
      <SafeAreaView edges={['top', 'bottom']} style={styles.controls}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: theme.spacing.md,
          }}
        >
          <IconButton
            icon={X}
            accessibilityLabel="Close camera"
            onPress={onCancel}
            variant="filled"
            testID="camera-close"
          />
        </View>
        <View
          style={{ alignItems: 'center', gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
        >
          <AppText align="center" style={[styles.hint, { color: theme.colors.onPrimary }]}>
            {captureFailed ? "Couldn't take the photo. Hold still and try again." : hint}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xxl,
            }}
          >
            {onUseLibrary ? (
              <IconButton
                icon={ImageIcon}
                accessibilityLabel="Choose from library"
                onPress={onUseLibrary}
                variant="filled"
              />
            ) : (
              <View style={{ width: 44 }} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: !ready || capturing }}
              disabled={!ready || capturing}
              onPress={takePicture}
              testID="camera-shutter"
              style={[
                styles.shutter,
                { borderColor: theme.colors.onPrimary, opacity: ready ? 1 : 0.5 },
              ]}
            >
              {capturing ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Camera color={theme.colors.onPrimary} size={28} />
              )}
            </Pressable>
            <View style={{ width: 44 }} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  controls: { flex: 1, justifyContent: 'space-between' },
  documentFrame: { width: '86%', aspectRatio: 1.58, borderWidth: 3 },
  faceFrame: { width: '64%', aspectRatio: 0.78, borderWidth: 3, borderRadius: 999 },
  hint: { paddingHorizontal: 32, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
