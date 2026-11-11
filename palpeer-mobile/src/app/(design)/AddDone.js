// Route for the "AddDone" artboard (live backend props).
import AddScreen from '@/newui/screens/Add';
import { useLiveAdd } from '@/design/bridge/useLiveAdd';
import { liveScreen } from '@/design/dc/route';

export default liveScreen(AddScreen, { stage: 'done' }, useLiveAdd);