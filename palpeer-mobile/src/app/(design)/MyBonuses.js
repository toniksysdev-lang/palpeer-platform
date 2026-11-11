// Route for My bonuses — newui presentation, live backend props.
import { useLiveMyBonuses } from '@/design/bridge/useLiveMyBonuses';
import { liveScreen } from '@/design/dc/route';
import MyBonusesScreen from '@/newui/screens/MyBonuses';

export default liveScreen(MyBonusesScreen, {}, useLiveMyBonuses);
