// Route for the "AddWait" artboard (live backend props).
import AddScreen from '@/design/screens/Add';
import { useLiveAdd } from '@/design/bridge/useLiveAdd';
import { screen } from '@/design/dc/route';

export default screen(AddScreen, { stage: 'wait' }, useLiveAdd);