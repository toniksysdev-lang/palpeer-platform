// Route for design Notification settings (live backend props).
import NotificationSettingsScreen from '@/design/screens/NotificationSettings';
import { useLiveNotificationSettings } from '@/design/bridge/useLiveNotificationSettings';
import { screen } from '@/design/dc/route';

export default screen(NotificationSettingsScreen, {}, useLiveNotificationSettings);
