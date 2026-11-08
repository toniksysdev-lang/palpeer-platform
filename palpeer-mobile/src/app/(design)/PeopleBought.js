// Route for the "PeopleBought" artboard (live backend props).
import PeopleScreen from '@/design/screens/People';
import { useLivePeople } from '@/design/bridge/useLivePeople';
import { screen } from '@/design/dc/route';

export default screen(PeopleScreen, { stage: 'bought' }, useLivePeople);