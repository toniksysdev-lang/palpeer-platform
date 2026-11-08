import { securityCommands } from '@/services/security/securityCommands';

/** Verifies a 4-digit PIN against the backend. Returns true on success. */
export async function verifyDesignPin(pin: string): Promise<boolean> {
  const result = await securityCommands.verifyPin({ pin });
  return result.ok;
}
