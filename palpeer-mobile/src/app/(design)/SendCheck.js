// Route for the "SendCheck" artboard (live backend props).
import SendScreen from '@/design/screens/Send';
import { useLiveSend } from '@/design/bridge/useLiveSend';
import { screen } from '@/design/dc/route';

export default screen(SendScreen, { stage: 'check' }, useLiveSend);