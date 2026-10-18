import type { CameraType } from 'expo-camera';

import type { CapturedImage } from '../image';

/**
 * Opens getUserMedia inside a user-gesture (button press). Expo CameraView starts the stream
 * from a useEffect after unlock, which many browsers treat as non-gestured and deny silently.
 */
export async function openWebCameraStream(facing: CameraType): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  const preferred: MediaStreamConstraints = {
    audio: false,
    video:
      facing === 'front'
        ? { facingMode: 'user' }
        : { facingMode: { ideal: 'environment' } },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (error) {
    // Desktop webcams often lack facingMode metadata — fall back to any camera.
    if (shouldRetryWithoutFacing(error)) {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    throw error;
  }
}

function shouldRetryWithoutFacing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'TypeError';
}

export function stopWebCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

/** Grabs the current video frame as a JPEG data URL for KYC upload. */
export async function captureWebCameraFrame(
  video: HTMLVideoElement,
): Promise<CapturedImage> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Camera preview is not ready yet.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Could not capture the camera frame.');
  }
  context.drawImage(video, 0, 0, width, height);

  const uri = canvas.toDataURL('image/jpeg', 0.92);
  return { uri, width, height };
}

function isEmbeddedFrame(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // Cross-origin parent access throws — that still means we're framed.
    return true;
  }
}

export function webCameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    if (isEmbeddedFrame()) {
      return 'Camera is blocked in this preview frame. Hard-refresh the phone preview (or open Expo web directly on port 8081), allow the camera when asked, then try again.';
    }
    return 'Camera access is blocked for this site. Click the camera icon in the address bar, allow camera, then try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another tab or app. Close it and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  return "We couldn't start the camera. Use HTTPS or localhost, allow camera access, and try again.";
}
