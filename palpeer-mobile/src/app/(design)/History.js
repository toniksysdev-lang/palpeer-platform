// Route for History — newui presentation, live backend props.
import { useLiveHistory } from '@/design/bridge/useLiveHistory';
import { liveScreen } from '@/design/dc/route';
import HistoryScreen from '@/newui/screens/History';

export default liveScreen(HistoryScreen, {}, useLiveHistory);
