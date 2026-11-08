// Route for the "PinReset" artboard (live backend props).
import PinResetScreen from '@/design/screens/PinReset';
import { useLivePinReset } from '@/design/bridge/useLivePinReset';
import { screen } from '@/design/dc/route';

export default screen(PinResetScreen, {}, useLivePinReset);