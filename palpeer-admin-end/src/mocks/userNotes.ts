import type { SpringPage } from '@/types/admin';
import type { CreateUserNoteInput, UserNote } from '@/types/userNotes';

const notes: UserNote[] = [
  {
    id: 'note-1',
    userId: 'u-4',
    category: 'INCIDENT',
    body: 'Customer reported an unrecognised login from a new device. Account suspended pending review.',
    authorUserId: 'admin-1',
    authorEmail: 'admin@palpeer.local',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export function mockListUserNotes(
  userId: string,
  params?: { page?: number; size?: number },
): SpringPage<UserNote> {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const rows = notes
    .filter((note) => note.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const content = rows.slice(page * size, page * size + size);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  return {
    content,
    totalElements: rows.length,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockCreateUserNote(userId: string, input: CreateUserNoteInput): UserNote {
  const note: UserNote = {
    id: `note-${notes.length + 1}-${Date.now()}`,
    userId,
    category: input.category,
    body: input.body.trim(),
    authorUserId: 'admin-1',
    authorEmail: 'admin@palpeer.local',
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  return note;
}
