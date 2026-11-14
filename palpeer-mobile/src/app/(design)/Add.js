// Route for the "Add money" artboard.
import AddScreen from '@/newui/screens/Add';
import { useLiveAdd } from '@/design/bridge/useLiveAdd';
import { liveFlowScreen } from '@/design/dc/route';

export default liveFlowScreen(AddScreen, {}, useLiveAdd);
