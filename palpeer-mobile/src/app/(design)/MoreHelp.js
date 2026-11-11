// Route for Get help — opens More with the help sheet.
import { useLiveMore } from '@/design/bridge/useLiveMore';
import { liveScreen } from '@/design/dc/route';
import MoreScreen from '@/newui/screens/More';

export default liveScreen(MoreScreen, { sheet: 'help' }, useLiveMore);
