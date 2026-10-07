import * as SecureStore from 'expo-secure-store';

import { logger } from '@/utils/logger';

const KEYS = {
  refreshToken: 'palpeer.refreshToken',
  userId: 'palpeer.userId',
  email: 'palpeer.email',
  /** User who turned on biometric unlock on this device; unlock applies only to that user. */
  biometricUserId: 'palpeer.biometricUserId',
  /** Random per-install identifier registered with POST /security/devices. */
  deviceIdentifier: 'palpeer.deviceIdentifier',
  /** Backend record id of this install's push registration (not the push token). */
  pushTokenId: 'palpeer.pushTokenId',
} as const;

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type StoredSession = {
  refreshToken: string;
  userId: string;
  email: string | null;
};

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch (error) {
    logger.warn('Secure storage read failed', { key, error });
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

async function remove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch (error) {
    logger.warn('Secure storage delete failed', { key, error });
  }
}

export const secureStorage = {
  async loadSession(): Promise<StoredSession | null> {
    const [refreshToken, userId, email] = await Promise.all([
      read(KEYS.refreshToken),
      read(KEYS.userId),
      read(KEYS.email),
    ]);
    if (!refreshToken || !userId) return null;
    return { refreshToken, userId, email };
  },

  async saveSession(session: StoredSession): Promise<void> {
    await write(KEYS.refreshToken, session.refreshToken);
    await write(KEYS.userId, session.userId);
    if (session.email) {
      await write(KEYS.email, session.email);
    }
  },

  async updateRefreshToken(refreshToken: string): Promise<void> {
    await write(KEYS.refreshToken, refreshToken);
  },

  /** Ends the stored session. Biometric unlock is tied to a session, so it is turned off too. */
  async clearSession(): Promise<void> {
    await Promise.all([
      remove(KEYS.refreshToken),
      remove(KEYS.userId),
      remove(KEYS.email),
      remove(KEYS.biometricUserId),
    ]);
  },

  getBiometricUserId(): Promise<string | null> {
    return read(KEYS.biometricUserId);
  },

  async setBiometricUserId(userId: string | null): Promise<void> {
    if (userId) {
      await write(KEYS.biometricUserId, userId);
    } else {
      await remove(KEYS.biometricUserId);
    }
  },

  getDeviceIdentifier(): Promise<string | null> {
    return read(KEYS.deviceIdentifier);
  },

  async setDeviceIdentifier(value: string): Promise<void> {
    await write(KEYS.deviceIdentifier, value);
  },

  getPushTokenId(): Promise<string | null> {
    return read(KEYS.pushTokenId);
  },

  async setPushTokenId(id: string | null): Promise<void> {
    if (id) {
      await write(KEYS.pushTokenId, id);
    } else {
      await remove(KEYS.pushTokenId);
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all(Object.values(KEYS).map(remove));
  },
};
