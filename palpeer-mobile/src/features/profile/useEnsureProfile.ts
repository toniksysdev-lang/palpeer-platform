import { useEffect, useRef } from 'react';

import { toAppError } from '@/services/api/errors';
import { useCreateProfileMutation, useGetMyProfileQuery } from '@/services/api/profileApi';

/**
 * Loads the caller's profile, creating the (empty) record once if the backend has none yet.
 * A concurrent create (409 PROFILE_EXISTS) just triggers a reload.
 */
export function useEnsureProfile() {
  const query = useGetMyProfileQuery();
  const [create, creation] = useCreateProfileMutation();
  const attempted = useRef(false);
  const missing = query.error ? toAppError(query.error).kind === 'notFound' : false;
  const { refetch } = query;

  useEffect(() => {
    if (!missing || attempted.current) return;
    attempted.current = true;
    void create()
      .unwrap()
      .catch((raw: unknown) => {
        if (toAppError(raw).code === 'PROFILE_EXISTS') void refetch();
      });
  }, [missing, create, refetch]);

  const creating = creation.isLoading || (missing && !creation.isError && !creation.isSuccess);
  const error = creation.isError
    ? toAppError(creation.error)
    : query.error && !missing
      ? toAppError(query.error)
      : null;

  const retry = () => {
    attempted.current = false;
    creation.reset();
    void refetch();
  };

  return {
    profile: query.data ?? creation.data ?? null,
    loading: query.isLoading || creating,
    error: error?.code === 'PROFILE_EXISTS' ? null : error,
    retry,
  };
}
