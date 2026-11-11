// Route for the "StartKycFail" artboard (live backend props).
import StartScreen from '@/newui/screens/Start';
import { useLiveStart } from '@/design/bridge/useLiveStart';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(StartScreen, { stage: 'kycFail', fails: 1 }, useLiveStart);