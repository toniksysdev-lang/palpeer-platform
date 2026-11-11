// Route for the "SendCheck" artboard (live backend props).
import SendScreen from '@/newui/screens/Send';
import { useLiveSend } from '@/design/bridge/useLiveSend';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(SendScreen, { stage: 'check' }, useLiveSend);