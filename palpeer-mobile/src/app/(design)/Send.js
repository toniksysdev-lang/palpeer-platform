// Route for the "Send money" artboard.
import SendScreen from '@/newui/screens/Send';
import { useLiveSend } from '@/design/bridge/useLiveSend';
import { liveFlowScreen } from '@/design/dc/route';

export default liveFlowScreen(SendScreen, {}, useLiveSend);
