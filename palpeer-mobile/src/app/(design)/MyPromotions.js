// Route for the "Promotions" artboard (live backend props).
import MyPromotionsScreen from '@/design/screens/MyPromotions';
import { useLiveMyPromotions } from '@/design/bridge/useLiveMyPromotions';
import { screen } from '@/design/dc/route';

export default screen(MyPromotionsScreen, {}, useLiveMyPromotions);
