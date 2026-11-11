// Route for the "SendDone" artboard (live backend props).
import SendScreen from '@/newui/screens/Send';
import { useLiveSend } from '@/design/bridge/useLiveSend';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(SendScreen, { stage: 'done' }, useLiveSend);