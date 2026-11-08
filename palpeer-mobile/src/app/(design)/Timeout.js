// Route for the "Timeout" artboard (live backend props).
import MainScreen from '@/design/screens/Main';
import { useLiveMain } from '@/design/bridge/useLiveMain';
import { screen } from '@/design/dc/route';

export default screen(MainScreen, { showTimeout: true }, useLiveMain);