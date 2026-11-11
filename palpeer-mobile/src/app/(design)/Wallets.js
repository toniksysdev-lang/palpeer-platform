// Route for all-wallets overlay entry — same Home with showAll hint.
import { useLiveMain } from '@/design/bridge/useLiveMain';
import { liveScreen } from '@/design/dc/route';
import HomeScreen from '@/newui/screens/Home';

export default liveScreen(HomeScreen, { showAll: true }, useLiveMain);
