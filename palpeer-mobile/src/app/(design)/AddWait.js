// Route for the "AddWait" artboard (live backend props).
import AddScreen from '@/newui/screens/Add';
import { useLiveAdd } from '@/design/bridge/useLiveAdd';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(AddScreen, { stage: 'wait' }, useLiveAdd);