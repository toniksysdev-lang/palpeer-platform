// Route for More — newui presentation, live backend props.
import { useLiveMore } from '@/design/bridge/useLiveMore';
import { liveScreen } from '@/design/dc/route';
import MoreScreen from '@/newui/screens/More';

export default liveScreen(MoreScreen, {}, useLiveMore);
