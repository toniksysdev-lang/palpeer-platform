import type {
  DeviceResponse,
  PinStatusResponse,
  SecurityQuestionResponse,
} from '@/types/api/security';

import { baseApi } from './baseApi';

/**
 * Security reads and device management. Calls whose bodies are secrets (PIN set/change/verify/
 * reset, security answers, device credential) live in `securityCommands` so they never enter the
 * Redux store.
 */
export const securityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPinStatus: build.query<PinStatusResponse, void>({
      query: () => ({ path: '/security/pin' }),
      providesTags: [{ type: 'Security', id: 'PIN' }],
    }),
    getSecurityQuestions: build.query<SecurityQuestionResponse[], void>({
      query: () => ({ path: '/security/questions' }),
      providesTags: [{ type: 'Security', id: 'QUESTIONS' }],
    }),
    getDevices: build.query<DeviceResponse[], void>({
      query: () => ({ path: '/security/devices' }),
      providesTags: [{ type: 'Security', id: 'DEVICES' }],
    }),
    setDeviceEnabled: build.mutation<DeviceResponse, { deviceId: string; enabled: boolean }>({
      query: ({ deviceId, enabled }) => ({
        path: `/security/devices/${encodeURIComponent(deviceId)}/${enabled ? 'enable' : 'disable'}`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Security', id: 'DEVICES' }],
    }),
    deleteDevice: build.mutation<void, string>({
      query: (deviceId) => ({
        path: `/security/devices/${encodeURIComponent(deviceId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Security', id: 'DEVICES' }],
    }),
  }),
});

export const {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
  useGetDevicesQuery,
  useSetDeviceEnabledMutation,
  useDeleteDeviceMutation,
} = securityApi;
