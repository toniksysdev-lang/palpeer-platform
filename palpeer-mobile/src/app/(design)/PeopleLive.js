// Route for the "PeopleLive" artboard (live backend props).
import { useLivePeople } from '@/design/bridge/useLivePeople';
import { liveScreen } from '@/design/dc/route';
import PeopleScreen from '@/newui/screens/People';

export default liveScreen(PeopleScreen, { stage: 'live' }, useLivePeople);