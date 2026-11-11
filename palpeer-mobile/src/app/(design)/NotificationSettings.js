// Route for Notification settings — newui presentation, live backend props.
import { useLiveNotificationSettings } from '@/design/bridge/useLiveNotificationSettings';
import { liveScreen } from '@/design/dc/route';
import NotificationSettingsScreen from '@/newui/screens/NotificationSettings';

export default liveScreen(NotificationSettingsScreen, {}, useLiveNotificationSettings);