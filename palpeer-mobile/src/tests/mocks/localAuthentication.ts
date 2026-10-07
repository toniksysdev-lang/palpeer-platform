export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 } as const;

type AuthResult = { success: true } | { success: false; error: string };

export const localAuth = {
  hardware: true,
  enrolled: true,
  types: [AuthenticationType.FINGERPRINT] as number[],
  nextResults: [] as AuthResult[],
  reset() {
    this.hardware = true;
    this.enrolled = true;
    this.types = [AuthenticationType.FINGERPRINT];
    this.nextResults = [];
    authenticateAsync.mockClear();
  },
};

export const hasHardwareAsync = jest.fn(async () => localAuth.hardware);
export const isEnrolledAsync = jest.fn(async () => localAuth.enrolled);
export const supportedAuthenticationTypesAsync = jest.fn(async () => localAuth.types);
export const authenticateAsync = jest.fn(
  async (): Promise<AuthResult> => localAuth.nextResults.shift() ?? { success: true },
);
