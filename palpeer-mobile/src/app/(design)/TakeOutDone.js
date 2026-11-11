// Route for the "TakeOutDone" artboard (live backend props).
import TakeOutScreen from '@/newui/screens/TakeOut';
import { useLiveTakeOut } from '@/design/bridge/useLiveTakeOut';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(TakeOutScreen, { stage: 'done' }, useLiveTakeOut);