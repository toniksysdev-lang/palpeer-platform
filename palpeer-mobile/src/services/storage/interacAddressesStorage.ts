import { authorizedRequest } from '@/services/api/authorized';
import { logger } from '@/utils/logger';

export type InteracAddress = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

type ApiInteracAddress = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapAddress(row: ApiInteracAddress): InteracAddress {
  return {
    id: row.id,
    email: normalizeEmail(row.email),
    firstName: row.firstName?.trim() ?? '',
    lastName: row.lastName?.trim() ?? '',
    createdAt: row.createdAt,
  };
}

/**
 * CAD Interac payer addresses — persisted on the server so they survive app reinstall.
 * `userId` is kept in the public API for call-site compatibility; the backend scopes by JWT.
 */
export const interacAddressesStorage = {
  async list(_userId: string): Promise<InteracAddress[]> {
    const result = await authorizedRequest<ApiInteracAddress[]>('/me/interac-addresses');
    if (!result.ok) {
      logger.warn('Interac addresses load failed', { error: result.error });
      return [];
    }
    return (result.data ?? [])
      .filter((item) => item && typeof item.id === 'string' && typeof item.email === 'string')
      .map(mapAddress);
  },

  async save(
    _userId: string,
    address: Omit<InteracAddress, 'id' | 'createdAt'> & { id?: string },
  ): Promise<InteracAddress> {
    const result = await authorizedRequest<ApiInteracAddress>('/me/interac-addresses', {
      method: 'POST',
      body: {
        email: normalizeEmail(address.email),
        firstName: address.firstName.trim(),
        lastName: address.lastName.trim(),
      },
    });
    if (!result.ok) {
      logger.warn('Interac address save failed', { error: result.error });
      throw new Error(result.error.message || 'Could not save Interac address');
    }
    return mapAddress(result.data);
  },

  async remove(_userId: string, id: string): Promise<void> {
    const result = await authorizedRequest<void>(`/me/interac-addresses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!result.ok) {
      logger.warn('Interac address delete failed', { error: result.error });
      throw new Error(result.error.message || 'Could not delete Interac address');
    }
  },
};
