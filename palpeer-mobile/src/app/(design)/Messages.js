// Route for Messages — newui presentation, live backend props.
import { useLiveMessages } from '@/design/bridge/useLiveMessages';
import { liveScreen } from '@/design/dc/route';
import MessagesScreen from '@/newui/screens/Messages';

export default liveScreen(MessagesScreen, {}, useLiveMessages);
