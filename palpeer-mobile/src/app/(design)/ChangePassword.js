// Route for Change password — newui presentation, live backend props.
import { useLiveChangePassword } from '@/design/bridge/useLiveChangePassword';
import { liveScreen } from '@/design/dc/route';
import ChangePasswordScreen from '@/newui/screens/ChangePassword';

export default liveScreen(ChangePasswordScreen, {}, useLiveChangePassword);
