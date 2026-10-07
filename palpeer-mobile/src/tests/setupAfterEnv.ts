require('react-native-reanimated').setUpTests();

// Full-suite runs share CPU across workers; the defaults (1 s / 5 s) flake under that load.
require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);
