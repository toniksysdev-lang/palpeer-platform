// Route for new-device Face/Fingerprint or PIN — newui presentation.
import { useLiveConfirmPin } from '@/design/bridge/useLiveConfirmPin';
import { liveScreen } from '@/design/dc/route';
import ConfirmPinScreen from '@/newui/screens/ConfirmPin';

export default liveScreen(ConfirmPinScreen, {}, useLiveConfirmPin);
