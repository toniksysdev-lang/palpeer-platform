// Reanimated is mocked in setup.ts (setUpTests is a no-op there).

// Full-suite runs share CPU across workers; the defaults (1 s / 5 s) flake under that load.
require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);

// Camera / picker often under-report size; prepareImage measures via Image.getSize.
// Drive that path from media.sizes so KYC tests match production behaviour.
const { Image } = require('react-native');
const { media } = require('./mocks/media');
jest.spyOn(Image, 'getSize').mockImplementation(
  (
    uri: string,
    success: (width: number, height: number) => void,
    failure?: (error: Error) => void,
  ) => {
    const size = media.sizes[uri];
    if (size) {
      success(size.width, size.height);
      return;
    }
    failure?.(new Error(`No size registered for ${uri}`));
  },
);
