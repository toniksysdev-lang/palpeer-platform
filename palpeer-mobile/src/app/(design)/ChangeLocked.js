// Route for the "ChangeLocked" artboard (live backend props).
import ChangeScreen from '@/newui/screens/Change';
import { useLiveChange } from '@/design/bridge/useLiveChange';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(ChangeScreen, { stage: 'locked' }, useLiveChange);