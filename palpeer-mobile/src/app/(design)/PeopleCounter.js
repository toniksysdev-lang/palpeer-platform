// Route for the "PeopleCounter" artboard (live backend props).
import PeopleScreen from '@/design/screens/People';
import { useLivePeople } from '@/design/bridge/useLivePeople';
import { screen } from '@/design/dc/route';

export default screen(PeopleScreen, { stage: 'counter' }, useLivePeople);