import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { appConfig } from '@/config/env';
import {
  clearSession,
  getRefreshToken,
  loadPersistedSession,
  persistSession,
} from '@/features/auth/session';
import { decodeJwtPayload, isJwtExpired } from '@/lib/jwt';
import { can as canPermission } from '@/lib/permissions';
import { mockAdminPermissions, mockLogin } from '@/mocks/auth';
import { setSessionExpiredHandler } from '@/services/api/client';
import {
  loginRequest,
  logoutRequest,
  verifyAdminAccess,
  verifyMfaRequest,
} from '@/services/api/auth';
import { ApiClientError } from '@/types/api';

export type AuthUser = {
  userId: string;
  email: string;
  roleCodes?: string[];
};

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  isAdmin: boolean;
  /** When true, admin must enroll TOTP before other admin APIs work. */
  mfaEnrollmentRequired: boolean;
  /** Resolved from GET /admin/me when available; 'unknown' only in edge cases. */
  permissions: readonly string[] | 'unknown';
  roles: readonly string[];
  can: (permission?: string) => boolean;
  login: (input: {
    email: string;
    password: string;
    remember: boolean;
    mfaCode?: string;
    mfaToken?: string;
  }) => Promise<{ mfaRequired?: boolean; mfaToken?: string } | void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(userId: string, accessToken: string): AuthUser {
  const payload = decodeJwtPayload(accessToken);
  return {
    userId,
    email: payload?.email ?? 'admin',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [permissions, setPermissions] = useState<readonly string[] | 'unknown'>('unknown');
  const [roles, setRoles] = useState<readonly string[]>([]);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const resetAnonymous = useCallback((expiredMessage?: string) => {
    clearSession();
    queryClient.clear();
    setUser(null);
    setIsAdmin(false);
    setMfaEnrollmentRequired(false);
    setPermissions('unknown');
    setRoles([]);
    setStatus('anonymous');
    if (expiredMessage) {
      setSessionExpiredMessage(expiredMessage);
    }
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      resetAnonymous('Your session has expired. Please sign in again.');
    });
    return () => setSessionExpiredHandler(null);
  }, [resetAnonymous]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const persisted = loadPersistedSession();
      if (!persisted) {
        if (!cancelled) setStatus('anonymous');
        return;
      }

      if (appConfig.useMockApi) {
        if (!cancelled) {
          setUser(toUser(persisted.userId, persisted.accessToken));
          setIsAdmin(true);
          setMfaEnrollmentRequired(false);
          setPermissions(mockAdminPermissions());
          setRoles(['SUPER_ADMIN']);
          setStatus('authenticated');
        }
        return;
      }

      try {
        if (isJwtExpired(persisted.accessToken)) {
          // api client refresh path will run on verify call if refresh still valid
        }
        const me = await verifyAdminAccess();
        if (cancelled) return;
        setUser({
          userId: me.userId,
          email: me.email || toUser(persisted.userId, persisted.accessToken).email,
          roleCodes: [...me.roleCodes],
        });
        setIsAdmin(true);
        setMfaEnrollmentRequired(Boolean(me.mfaEnrollmentRequired));
        setPermissions([...me.permissionCodes]);
        setRoles([...me.roleCodes]);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiClientError && error.status === 403
            ? 'This account is not authorized for admin access.'
            : 'Your session has expired. Please sign in again.';
        resetAnonymous(message);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [resetAnonymous]);

  const login = useCallback(
    async (input: {
      email: string;
      password: string;
      remember: boolean;
      mfaCode?: string;
      mfaToken?: string;
    }) => {
      setSessionExpiredMessage(null);

      if (appConfig.useMockApi) {
        const tokens = mockLogin(input);
        persistSession(tokens, input.remember, { email: input.email });
        setUser(toUser(tokens.userId, tokens.accessToken));
        setIsAdmin(true);
        setMfaEnrollmentRequired(false);
        setPermissions(mockAdminPermissions());
        setRoles(['SUPER_ADMIN']);
        setStatus('authenticated');
        return;
      }

      let tokens =
        input.mfaToken && input.mfaCode
          ? await verifyMfaRequest({ mfaToken: input.mfaToken, code: input.mfaCode })
          : await loginRequest({
              email: input.email,
              password: input.password,
              rememberMe: input.remember,
            });

      if (tokens.mfaRequired && tokens.mfaToken) {
        return { mfaRequired: true, mfaToken: tokens.mfaToken };
      }

      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new ApiClientError(401, 'INVALID_CREDENTIALS', 'Authentication failed. Please try again.');
      }

      persistSession(tokens, input.remember, { email: input.email });

      let me;
      try {
        me = await verifyAdminAccess();
      } catch (error) {
        clearSession();
        if (error instanceof ApiClientError && (error.status === 403 || error.code === 'ACCESS_DENIED')) {
          throw new ApiClientError(
            403,
            'NOT_ADMIN',
            'This account is signed in but is not authorized for the admin console.',
          );
        }
        throw error;
      }

      setUser({
        userId: me.userId,
        email: me.email || toUser(tokens.userId, tokens.accessToken).email,
        roleCodes: [...me.roleCodes],
      });
      setIsAdmin(true);
      setMfaEnrollmentRequired(Boolean(me.mfaEnrollmentRequired));
      setPermissions([...me.permissionCodes]);
      setRoles([...me.roleCodes]);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken && !appConfig.useMockApi) {
        await logoutRequest(refreshToken);
      }
    } catch {
      // Always clear local session even if revoke fails.
    } finally {
      resetAnonymous();
    }
  }, [resetAnonymous]);

  const refreshMe = useCallback(async () => {
    if (appConfig.useMockApi) {
      setMfaEnrollmentRequired(false);
      return;
    }
    const me = await verifyAdminAccess();
    setMfaEnrollmentRequired(Boolean(me.mfaEnrollmentRequired));
    setPermissions([...me.permissionCodes]);
    setRoles([...me.roleCodes]);
    setUser((prev) =>
      prev
        ? { ...prev, email: me.email || prev.email, roleCodes: [...me.roleCodes] }
        : prev,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin,
      mfaEnrollmentRequired,
      permissions,
      roles,
      can: (permission?: string) => canPermission(permissions, permission, { isAdmin }),
      login,
      logout,
      refreshMe,
      sessionExpiredMessage,
      clearSessionExpiredMessage: () => setSessionExpiredMessage(null),
    }),
    [
      status,
      user,
      isAdmin,
      mfaEnrollmentRequired,
      permissions,
      roles,
      login,
      logout,
      refreshMe,
      sessionExpiredMessage,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
