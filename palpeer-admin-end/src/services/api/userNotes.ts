import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type { CreateUserNoteInput, UserNote } from '@/types/userNotes';

export async function listUserNotes(
  userId: string,
  params?: { page?: number; size?: number },
): Promise<SpringPage<UserNote>> {
  const search = new URLSearchParams({
    page: String(params?.page ?? 0),
    size: String(params?.size ?? 20),
  });
  return apiRequest<SpringPage<UserNote>>(`/admin/users/${userId}/notes?${search.toString()}`);
}

export async function createUserNote(userId: string, input: CreateUserNoteInput): Promise<UserNote> {
  return apiRequest<UserNote>(`/admin/users/${userId}/notes`, { method: 'POST', body: input });
}
