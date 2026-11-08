// Route for the "More" artboard (live backend props).
import MoreScreen from '@/design/screens/More';
import { useLiveMore } from '@/design/bridge/useLiveMore';
import { screen } from '@/design/dc/route';

export default screen(MoreScreen, {}, useLiveMore);