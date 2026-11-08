// Route for the "ChangeCheck" artboard (live backend props).
import ChangeScreen from '@/design/screens/Change';
import { useLiveChange } from '@/design/bridge/useLiveChange';
import { screen } from '@/design/dc/route';

export default screen(ChangeScreen, { stage: 'check' }, useLiveChange);