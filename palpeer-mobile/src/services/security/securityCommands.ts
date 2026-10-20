import { authorizedRequest } from '@/services/api/authorized';
import type { ApiResult } from '@/services/api/client';
import type {
  ChangePinRequest,
  DeviceResponse,
  RegisterDeviceRequest,
  ResetPinRequest,
  SecurityQuestionResponse,
  SetPinRequest,
  SetSecurityQuestionsRequest,
  VerifyPinRequest,
  VerifySecurityAnswersRequest,
} from '@/types/api/security';

/**
 * Security calls whose request bodies are secrets. They bypass RTK Query on purpose so PINs,
 * answers and the device credential are never retained in Redux state or dev tooling; callers
 * invalidate the relevant `Security` tags after a success.
 */
export const securityCommands = {
  setPin(body: SetPinRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/security/pin', { method: 'POST', body });
  },
  changePin(body: ChangePinRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/security/pin', { method: 'PUT', body });
  },
  verifyPin(body: VerifyPinRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/security/pin/verify', { method: 'POST', body });
  },
  resetPin(body: ResetPinRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/security/pin/reset', { method: 'POST', body });
  },
  verifyAnswers(body: VerifySecurityAnswersRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/security/questions/verify', { method: 'POST', body });
  },
  setQuestions(body: SetSecurityQuestionsRequest): Promise<ApiResult<SecurityQuestionResponse[]>> {
    return authorizedRequest('/security/questions', { method: 'PUT', body });
  },
  registerDevice(body: RegisterDeviceRequest): Promise<ApiResult<DeviceResponse>> {
    return authorizedRequest('/security/devices', { method: 'POST', body });
  },
  listDevices(): Promise<ApiResult<DeviceResponse[]>> {
    return authorizedRequest('/security/devices');
  },
  deleteDevice(deviceId: string): Promise<ApiResult<void>> {
    return authorizedRequest(`/security/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  },
};
