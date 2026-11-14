import AsyncStorage from '@react-native-async-storage/async-storage';

import { authorizedRequest } from '@/services/api/authorized';
import { logger } from '@/utils/logger';

export type NgnBankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
};

type ApiNgnBankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
};

function mapAccount(row: ApiNgnBankAccount): NgnBankAccount {
  return {
    id: row.id,
    bankCode: (row.bankCode || '').trim(),
    bankName: (row.bankName || '').trim(),
    accountNumber: (row.accountNumber || '').replace(/\D/g, ''),
    accountName: (row.accountName || '').trim(),
    createdAt: row.createdAt,
  };
}

function localKey(userId: string): string {
  return `palpeer.ngnBanks.v1.${userId}`;
}

async function readLocal(userId: string): Promise<NgnBankAccount[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(localKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is NgnBankAccount =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as NgnBankAccount).id === 'string' &&
          typeof (item as NgnBankAccount).bankCode === 'string' &&
          typeof (item as NgnBankAccount).accountNumber === 'string',
      )
      .map((item) => ({
        id: item.id,
        bankCode: item.bankCode.trim(),
        bankName: (item.bankName || '').trim(),
        accountNumber: item.accountNumber.replace(/\D/g, ''),
        accountName: (item.accountName || 'Saved account').trim() || 'Saved account',
        createdAt: item.createdAt || new Date().toISOString(),
      }));
  } catch (error) {
    logger.warn('NGN bank accounts local read failed', { error });
    return [];
  }
}

async function writeLocal(userId: string, list: NgnBankAccount[]): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(localKey(userId), JSON.stringify(list));
}

/**
 * NGN withdrawal bank accounts.
 * Prefer the server (`/me/ngn-bank-accounts`) so accounts survive reinstall; if that API is
 * unavailable (not deployed yet / network), fall back to on-device storage so Take Out still works.
 */
export const ngnBankAccountsStorage = {
  async list(userId: string): Promise<NgnBankAccount[]> {
    const result = await authorizedRequest<ApiNgnBankAccount[]>('/me/ngn-bank-accounts');
    if (result.ok) {
      const remote = (result.data ?? [])
        .filter(
          (item) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.bankCode === 'string' &&
            typeof item.accountNumber === 'string',
        )
        .map(mapAccount);
      if (userId) {
        try {
          await writeLocal(userId, remote);
        } catch {
          /* ignore cache write */
        }
      }
      return remote;
    }
    logger.warn('NGN bank accounts load failed; using device cache', { error: result.error });
    return readLocal(userId);
  },

  async save(
    userId: string,
    account: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    },
  ): Promise<NgnBankAccount> {
    const body = {
      bankCode: account.bankCode.trim(),
      bankName: account.bankName.trim(),
      accountNumber: account.accountNumber.replace(/\D/g, ''),
      accountName: account.accountName.trim(),
    };
    const result = await authorizedRequest<ApiNgnBankAccount>('/me/ngn-bank-accounts', {
      method: 'POST',
      body,
    });
    if (result.ok) {
      const saved = mapAccount(result.data);
      if (userId) {
        const list = await readLocal(userId);
        const next = [saved, ...list.filter((a) => a.id !== saved.id)];
        await writeLocal(userId, next);
      }
      return saved;
    }

    logger.warn('NGN bank account save API failed; saving on device', { error: result.error });
    if (!userId) {
      throw new Error(result.error.message || 'Could not save bank account');
    }
    const list = await readLocal(userId);
    const existing = list.find(
      (a) => a.bankCode === body.bankCode && a.accountNumber === body.accountNumber,
    );
    const saved: NgnBankAccount = existing
      ? {
          ...existing,
          bankName: body.bankName,
          accountName: body.accountName,
        }
      : {
          id: `local-${Date.now()}-${body.accountNumber}`,
          bankCode: body.bankCode,
          bankName: body.bankName,
          accountNumber: body.accountNumber,
          accountName: body.accountName,
          createdAt: new Date().toISOString(),
        };
    const next = [saved, ...list.filter((a) => a.id !== saved.id)];
    await writeLocal(userId, next);
    return saved;
  },

  async remove(userId: string, id: string): Promise<void> {
    const result = await authorizedRequest<void>(`/me/ngn-bank-accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!result.ok && !id.startsWith('local-')) {
      logger.warn('NGN bank account delete API failed; removing device cache entry', {
        error: result.error,
      });
    }
    if (userId) {
      const list = await readLocal(userId);
      await writeLocal(
        userId,
        list.filter((a) => a.id !== id),
      );
    }
    if (!result.ok && !id.startsWith('local-') && result.error.kind === 'unauthorized') {
      throw new Error(result.error.message || 'Could not delete bank account');
    }
  },
};
