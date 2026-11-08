// Route for the "TakeOutNgn" artboard (live backend props).
import TakeOutScreen from '@/design/screens/TakeOut';
import { useLiveTakeOut } from '@/design/bridge/useLiveTakeOut';
import { screen } from '@/design/dc/route';

export default screen(TakeOutScreen, { stage: '', code: 'NGN' }, useLiveTakeOut);