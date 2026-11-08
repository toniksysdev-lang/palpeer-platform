// Route for the "PeopleEmpty" artboard (live backend props).
import PeopleScreen from '@/design/screens/People';
import { useLivePeople } from '@/design/bridge/useLivePeople';
import { screen } from '@/design/dc/route';

export default screen(PeopleScreen, { stage: 'empty' }, useLivePeople);