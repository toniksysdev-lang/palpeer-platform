// Route for the "StartKycFail" artboard (live backend props).
import StartScreen from '@/design/screens/Start';
import { useLiveStart } from '@/design/bridge/useLiveStart';
import { screen } from '@/design/dc/route';

export default screen(StartScreen, { stage: 'kycFail', fails: 1 }, useLiveStart);