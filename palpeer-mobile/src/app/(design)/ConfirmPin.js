// Route for the "Confirm it's you" new-device Face/Fingerprint or PIN artboard.
import ConfirmPinScreen from '@/design/screens/ConfirmPin';
import { useLiveConfirmPin } from '@/design/bridge/useLiveConfirmPin';
import { screen } from '@/design/dc/route';

export default screen(ConfirmPinScreen, {}, useLiveConfirmPin);
