// Route for the "My bonuses" artboard (live backend props).
import MyBonusesScreen from '@/design/screens/MyBonuses';
import { useLiveMyBonuses } from '@/design/bridge/useLiveMyBonuses';
import { screen } from '@/design/dc/route';

export default screen(MyBonusesScreen, {}, useLiveMyBonuses);
