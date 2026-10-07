import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { BLOCKED, GRANTED, media, UNDETERMINED } from '@/tests/mocks/media';
import { renderWithProviders } from '@/tests/render';

import { CameraCapture } from '../components/CameraCapture';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

async function renderCamera(overrides: Partial<Parameters<typeof CameraCapture>[0]> = {}) {
  const props = {
    facing: 'back' as const,
    overlay: 'document' as const,
    hint: 'Fit the document inside the frame',
    onCaptured: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  await renderWithProviders(<CameraCapture {...props} />);
  return props;
}

describe('CameraCapture', () => {
  beforeEach(() => {
    media.reset();
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  it('asks for permission only when the user taps Allow, then opens the camera', async () => {
    media.permission = UNDETERMINED;
    media.afterRequest = GRANTED;
    await renderCamera();

    expect(await screen.findByText('Allow camera access')).toBeTruthy();
    expect(media.requestPermission).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('camera-allow'));

    expect(media.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('camera-view')).toBeTruthy();
  });

  it('stays on the explanation when permission is denied again', async () => {
    media.permission = UNDETERMINED;
    media.afterRequest = BLOCKED;
    await renderCamera();

    await fireEvent.press(await screen.findByTestId('camera-allow'));

    expect(await screen.findByText('Camera access is off')).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('sends a permanently denied user to settings and offers the library', async () => {
    media.permission = BLOCKED;
    const onUseLibrary = jest.fn();
    await renderCamera({ onUseLibrary });

    await fireEvent.press(await screen.findByTestId('camera-open-settings'));
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(media.requestPermission).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('camera-use-library'));
    expect(onUseLibrary).toHaveBeenCalled();
  });

  it('shows an unavailable state when the camera fails to start', async () => {
    media.mountError = 'Camera in use';
    await renderCamera();

    expect(await screen.findByTestId('camera-unavailable')).toBeTruthy();
    expect(screen.getByText('Camera unavailable')).toBeTruthy();
  });

  it('captures a photo once the camera is ready', async () => {
    const props = await renderCamera();

    await fireEvent.press(await screen.findByTestId('camera-shutter'));

    await waitFor(() =>
      expect(props.onCaptured).toHaveBeenCalledWith({
        uri: 'file:///camera.jpg',
        width: 3000,
        height: 4000,
      }),
    );
  });

  it('lets the user try again when a capture fails', async () => {
    media.picture = new Error('capture failed');
    const props = await renderCamera();

    await fireEvent.press(await screen.findByTestId('camera-shutter'));

    expect(
      await screen.findByText("Couldn't take the photo. Hold still and try again."),
    ).toBeTruthy();
    expect(props.onCaptured).not.toHaveBeenCalled();
    expect(screen.getByTestId('camera-view')).toBeTruthy();
  });
});
