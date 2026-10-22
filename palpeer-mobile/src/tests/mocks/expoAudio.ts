export const playReceiveSoundMock = jest.fn();
export const seekToMock = jest.fn(() => Promise.resolve());

export const useAudioPlayer = () => ({
  play: playReceiveSoundMock,
  seekTo: seekToMock,
  volume: 1,
  playing: false,
  isLoaded: true,
});

export const setAudioModeAsync = jest.fn(() => Promise.resolve());
export const createAudioPlayer = () => ({
  play: playReceiveSoundMock,
  seekTo: seekToMock,
  volume: 1,
  remove: jest.fn(),
});
