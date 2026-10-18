/**
 * @jest-environment jsdom
 */
import {
  captureWebCameraFrame,
  openWebCameraStream,
  stopWebCameraStream,
  webCameraErrorMessage,
} from '../components/webCamera';

describe('webCamera', () => {
  const originalMedia = navigator.mediaDevices;

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMedia,
    });
  });

  it('opens a stream with facingMode and falls back when overconstrained', async () => {
    const stream = { id: 's1', getTracks: () => [] } as unknown as MediaStream;
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('over'), { name: 'OverconstrainedError' }))
      .mockResolvedValueOnce(stream);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    await expect(openWebCameraStream('back')).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: false, video: true });
  });

  it('captures a JPEG frame from the video element', async () => {
    const drawImage = jest.fn();
    const toDataURL = jest.fn(() => 'data:image/jpeg;base64,abc');
    const getContext = jest.fn(() => ({ drawImage }));
    const createElement = jest
      .spyOn(document, 'createElement')
      .mockReturnValue({ width: 0, height: 0, getContext, toDataURL } as unknown as HTMLCanvasElement);

    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    const image = await captureWebCameraFrame(video);

    expect(image).toEqual({ uri: 'data:image/jpeg;base64,abc', width: 1280, height: 720 });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
    createElement.mockRestore();
  });

  it('stops all tracks on a stream', () => {
    const stop = jest.fn();
    stopWebCameraStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('maps permission errors to actionable copy', () => {
    expect(webCameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/address bar|preview frame|8081/i);
    expect(webCameraErrorMessage({ name: 'NotReadableError' })).toMatch(/already in use/i);
  });
});
