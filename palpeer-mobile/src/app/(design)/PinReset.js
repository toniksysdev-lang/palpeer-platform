// Route for the "PinReset" artboard (live backend props).
import PinResetScreen from '@/newui/screens/PinReset';
import { useLivePinReset } from '@/design/bridge/useLivePinReset';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(PinResetScreen, {}, useLivePinReset);