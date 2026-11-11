// Route for add-wallet overlay — same Home with showAdd hint.
import { useLiveMain } from '@/design/bridge/useLiveMain';
import { liveScreen } from '@/design/dc/route';
import HomeScreen from '@/newui/screens/Home';

export default liveScreen(HomeScreen, { showAdd: true }, useLiveMain);
