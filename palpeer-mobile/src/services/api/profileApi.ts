import type { ProfileResponse, UpdateProfileRequest } from '@/types/api/profile';

import { baseApi } from './baseApi';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyProfile: build.query<ProfileResponse, void>({
      query: () => ({ path: '/profiles/me' }),
      providesTags: ['Profile'],
    }),
    createProfile: build.mutation<ProfileResponse, void>({
      query: () => ({ path: '/profiles', method: 'POST', body: {} }),
      invalidatesTags: ['Profile'],
    }),
    updateMyProfile: build.mutation<ProfileResponse, UpdateProfileRequest>({
      query: (body) => ({ path: '/profiles/me', method: 'PUT', body }),
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useCreateProfileMutation,
  useUpdateMyProfileMutation,
} = profileApi;
