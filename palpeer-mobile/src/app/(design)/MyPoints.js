// Route for the "My points" artboard (live backend props).
import MyPointsScreen from '@/design/screens/MyPoints';
import { useLiveMyPoints } from '@/design/bridge/useLiveMyPoints';
import { screen } from '@/design/dc/route';

export default screen(MyPointsScreen, {}, useLiveMyPoints);
