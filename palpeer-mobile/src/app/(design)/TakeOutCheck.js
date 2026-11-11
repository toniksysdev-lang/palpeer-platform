// Route for the "TakeOutCheck" artboard (live backend props).
import TakeOutScreen from '@/newui/screens/TakeOut';
import { useLiveTakeOut } from '@/design/bridge/useLiveTakeOut';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(TakeOutScreen, { stage: 'check' }, useLiveTakeOut);