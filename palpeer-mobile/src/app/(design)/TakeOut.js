// Route for the "Take out money" artboard.
import TakeOutScreen from '@/newui/screens/TakeOut';
import { useLiveTakeOut } from '@/design/bridge/useLiveTakeOut';
import { liveFlowScreen } from '@/design/dc/route';

export default liveFlowScreen(TakeOutScreen, {}, useLiveTakeOut);
