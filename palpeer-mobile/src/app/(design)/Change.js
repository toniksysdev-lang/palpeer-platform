// Route for the "Change money" artboard.
import ChangeScreen from '@/newui/screens/Change';
import { useLiveChange } from '@/design/bridge/useLiveChange';
import { liveFlowScreen } from '@/design/dc/route';

export default liveFlowScreen(ChangeScreen, {}, useLiveChange);
