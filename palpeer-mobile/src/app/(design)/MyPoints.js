// Route for My points — newui presentation, live backend props.
import { useLiveMyPoints } from '@/design/bridge/useLiveMyPoints';
import { liveScreen } from '@/design/dc/route';
import MyPointsScreen from '@/newui/screens/MyPoints';

export default liveScreen(MyPointsScreen, {}, useLiveMyPoints);
