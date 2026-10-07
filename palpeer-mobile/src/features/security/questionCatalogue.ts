/**
 * The backend has no question catalogue (CONTRACT_PENDING P3-02); it stores whatever key/text
 * pair the client sends. This list is the app's choice. Keys are sent upper-case, as stored.
 */
export const SECURITY_QUESTION_CATALOGUE = [
  { questionKey: 'FIRST_SCHOOL', questionText: 'What was the name of your first school?' },
  {
    questionKey: 'CHILDHOOD_FRIEND',
    questionText: 'What is the first name of your childhood best friend?',
  },
  { questionKey: 'BIRTH_TOWN', questionText: 'In which town or city were you born?' },
  { questionKey: 'FIRST_PET', questionText: 'What was the name of your first pet?' },
  {
    questionKey: 'FAVOURITE_TEACHER',
    questionText: 'What was the surname of your favourite teacher?',
  },
  { questionKey: 'CHILDHOOD_STREET', questionText: 'What street did you live on as a child?' },
  { questionKey: 'FIRST_JOB', questionText: 'What was the name of the company of your first job?' },
  { questionKey: 'PARENTS_MEETING_CITY', questionText: 'In which city did your parents meet?' },
] as const;

/** Backend minimum (provisional P3-02). */
export const SECURITY_QUESTION_COUNT = 2;
export const SECURITY_ANSWER_MAX = 200;
