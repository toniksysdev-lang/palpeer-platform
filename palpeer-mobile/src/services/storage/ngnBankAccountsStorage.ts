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

/**
 * NGN withdrawal bank accounts — persisted on the server so they survive app reinstall.
 * `userId` is kept in the public API for call-site compatibility; the backend scopes by JWT.
 */
export const ngnBankAccountsStorage = {
  async list(_userId: string): Promise<NgnBankAccount[]> {
    const result = await authorizedRequest<ApiNgnBankAccount[]>('/me/ngn-bank-accounts');
    if (!result.ok) {
      logger.warn('NGN bank accounts load failed', { error: result.error });
      return [];
    }
    return (result.data ?? [])
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.bankCode === 'string' &&
          typeof item.accountNumber === 'string',
      )
      .map(mapAccount);
  },

  async save(
    _userId: string,
    account: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    },
  ): Promise<NgnBankAccount> {
    const result = await authorizedRequest<ApiNgnBankAccount>('/me/ngn-bank-accounts', {
      method: 'POST',
      body: {
        bankCode: account.bankCode.trim(),
        bankName: account.bankName.trim(),
        accountNumber: account.accountNumber.replace(/\D/g, ''),
        accountName: account.accountName.trim(),
      },
    });
    if (!result.ok) {
      logger.warn('NGN bank account save failed', { error: result.error });
      throw new Error(result.error.message || 'Could not save bank account');
    }
    return mapAccount(result.data);
  },

  async remove(_userId: string, id: string): Promise<void> {
    const result = await authorizedRequest<void>(`/me/ngn-bank-accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!result.ok) {
      logger.warn('NGN bank account delete failed', { error: result.error });
      throw new Error(result.error.message || 'Could not delete bank account');
    }
  },
};
