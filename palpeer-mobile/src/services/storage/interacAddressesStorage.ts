import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const KEY_PREFIX = 'palpeer.interac.addresses.';

export type InteracAddress = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const interacAddressesStorage = {
  async list(userId: string): Promise<InteracAddress[]> {
    if (!userId) return [];
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as InteracAddress[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.email === 'string' &&
          item.email.includes('@'),
      );
    } catch (error) {
      logger.warn('Interac addresses load failed', { error });
      return [];
    }
  },

  async save(userId: string, address: Omit<InteracAddress, 'id' | 'createdAt'> & { id?: string }): Promise<InteracAddress> {
    const list = await this.list(userId);
    const email = normalizeEmail(address.email);
    const existing = list.find((item) => normalizeEmail(item.email) === email);
    const next: InteracAddress = {
      id: existing?.id ?? address.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      firstName: address.firstName.trim(),
      lastName: address.lastName.trim(),
      email,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const without = list.filter((item) => normalizeEmail(item.email) !== email);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify([next, ...without]));
    return next;
  },

  async remove(userId: string, id: string): Promise<void> {
    const list = await this.list(userId);
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify(list.filter((item) => item.id !== id)),
    );
  },
};
