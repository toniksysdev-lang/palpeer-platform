// Route for Privacy — newui presentation, live backend props.
import { useLivePrivacy } from '@/design/bridge/useLivePrivacy';
import { liveScreen } from '@/design/dc/route';
import PrivacyScreen from '@/newui/screens/Privacy';

export default liveScreen(PrivacyScreen, {}, useLivePrivacy);
