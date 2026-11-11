// Route for session timeout overlay — same Home with showTimeout hint.
import { useLiveMain } from '@/design/bridge/useLiveMain';
import { liveScreen } from '@/design/dc/route';
import HomeScreen from '@/newui/screens/Home';

export default liveScreen(HomeScreen, { showTimeout: true }, useLiveMain);
