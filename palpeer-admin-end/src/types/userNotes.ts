export const USER_NOTE_CATEGORIES = ['INCIDENT', 'FRAUD', 'COMPLIANCE', 'SUPPORT', 'GENERAL'] as const;

export type UserNoteCategory = (typeof USER_NOTE_CATEGORIES)[number];

export type UserNote = {
  id: string;
  userId: string;
  category: UserNoteCategory;
  body: string;
  authorUserId: string;
  authorEmail: string;
  createdAt: string;
};

export type CreateUserNoteInput = {
  category: UserNoteCategory;
  body: string;
};
