// Route for Home — newui presentation, live backend props.
import { useLiveMain } from '@/design/bridge/useLiveMain';
import { liveScreen } from '@/design/dc/route';
import HomeScreen from '@/newui/screens/Home';

export default liveScreen(HomeScreen, {}, useLiveMain);
