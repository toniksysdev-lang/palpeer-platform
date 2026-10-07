import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  type ForwardedRef,
} from 'react';
import { View } from 'react-native';

/**
 * One stand-in for expo-camera, expo-image-picker, expo-image-manipulator and
 * expo-screen-capture. Tests drive it through `media`.
 */
type Permission = { granted: boolean; canAskAgain: boolean; status: string } | null;
type Picture = { uri: string; width: number; height: number };
type LibraryResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: { uri: string; width: number; height: number }[] };

export const GRANTED: Permission = { granted: true, canAskAgain: true, status: 'granted' };
export const UNDETERMINED: Permission = {
  granted: false,
  canAskAgain: true,
  status: 'undetermined',
};
export const BLOCKED: Permission = { granted: false, canAskAgain: false, status: 'denied' };

const listeners = new Set<() => void>();

export const media = {
  permission: GRANTED as Permission,
  afterRequest: GRANTED as Permission,
  mountError: null as string | null,
  picture: { uri: 'file:///camera.jpg', width: 3000, height: 4000 } as Picture | Error,
  library: { canceled: true, assets: null } as LibraryResult | Error,
  /** Source dimensions the manipulator reports per uri (defaults to 3000×4000). */
  sizes: {} as Record<string, { width: number; height: number }>,
  requestPermission: jest.fn(async (): Promise<Permission> => {
    media.permission = media.afterRequest;
    listeners.forEach((listener) => listener());
    return media.permission;
  }),
  takePicture: jest.fn(async (): Promise<Picture> => {
    if (media.picture instanceof Error) throw media.picture;
    return media.picture;
  }),
  resize: jest.fn(),
  reset() {
    media.permission = GRANTED;
    media.afterRequest = GRANTED;
    media.mountError = null;
    media.picture = { uri: 'file:///camera.jpg', width: 3000, height: 4000 };
    media.library = { canceled: true, assets: null };
    media.sizes = {};
    media.requestPermission.mockClear();
    media.takePicture.mockClear();
    media.resize.mockClear();
    launchImageLibraryAsync.mockClear();
    usePreventScreenCapture.mockClear();
  },
};

// expo-camera
export function useCameraPermissions() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);
  return [media.permission, media.requestPermission] as const;
}

type CameraProps = {
  onCameraReady?: () => void;
  onMountError?: (event: { message: string }) => void;
  facing?: string;
};

export const CameraView = forwardRef(function CameraView(
  { onCameraReady, onMountError, facing }: CameraProps,
  ref: ForwardedRef<unknown>,
) {
  useImperativeHandle(ref, () => ({ takePictureAsync: media.takePicture }));
  useEffect(() => {
    if (media.mountError) onMountError?.({ message: media.mountError });
    else onCameraReady?.();
  }, [onCameraReady, onMountError]);
  return createElement(View, { testID: `mock-camera-${facing ?? 'back'}` });
});

// expo-image-picker
export const launchImageLibraryAsync = jest.fn(async () => {
  if (media.library instanceof Error) throw media.library;
  return media.library;
});

// expo-image-manipulator
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' };

export const ImageManipulator = {
  manipulate(uri: string) {
    let size = media.sizes[uri] ?? { width: 3000, height: 4000 };
    const context = {
      resize(target: { width?: number; height?: number }) {
        media.resize(target);
        const ratio = target.width ? target.width / size.width : (target.height ?? 0) / size.height;
        size = { width: Math.round(size.width * ratio), height: Math.round(size.height * ratio) };
        return context;
      },
      async renderAsync() {
        return {
          async saveAsync(options: { format: string; compress: number }) {
            return { uri: `file:///prepared.${options.format}`, ...size };
          },
        };
      },
    };
    return context;
  },
};

// expo-screen-capture
export const usePreventScreenCapture = jest.fn();
export const enableAppSwitcherProtectionAsync = jest.fn(async () => undefined);
export const disableAppSwitcherProtectionAsync = jest.fn(async () => undefined);
