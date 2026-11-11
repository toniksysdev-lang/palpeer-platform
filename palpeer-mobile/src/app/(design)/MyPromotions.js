// Route for Promotions — newui presentation, live backend props.
import { useLiveMyPromotions } from '@/design/bridge/useLiveMyPromotions';
import { liveScreen } from '@/design/dc/route';
import MyPromotionsScreen from '@/newui/screens/MyPromotions';

export default liveScreen(MyPromotionsScreen, {}, useLiveMyPromotions);
