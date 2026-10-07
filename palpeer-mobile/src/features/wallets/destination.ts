/**
 * Withdrawal destinations, mirroring how the backend parses `destinationReference`:
 * - CAD (Apaylo): text matching `\d{3}[:|;-]\d{5}[:|;-]\d+` is an EFT bank transfer; text with
 *   "@" is an Interac e-Transfer e-mail; any other text is an Interac phone number.
 * - NGN (Kuda): `bankCode:accountNumber`, both parts required (checked by Kuda name enquiry).
 */
export type CadMethod = 'email' | 'phone' | 'eft';

export type CadDestination =
  | { method: 'email'; email: string }
  | { method: 'phone'; phone: string }
  | { method: 'eft'; institution: string; transit: string; account: string };

export type NgnDestination = { bankCode: string; accountNumber: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EFT_PATTERN = /^\d{3}[:|;-]\d{5}[:|;-]\d+$/;

export type DestinationErrors = Record<string, string>;

export function validateCad(destination: CadDestination): DestinationErrors {
  switch (destination.method) {
    case 'email':
      return EMAIL_PATTERN.test(destination.email.trim())
        ? {}
        : { email: 'Enter the Interac e-mail address.' };
    case 'phone': {
      const phone = destination.phone.trim();
      if (!phone) return { phone: 'Enter the Interac phone number.' };
      // A phone containing "@" would be read as an e-mail by the backend.
      if (phone.includes('@')) return { phone: 'Enter a phone number, not an e-mail.' };
      return {};
    }
    case 'eft': {
      const errors: DestinationErrors = {};
      if (!/^\d{3}$/.test(destination.institution))
        errors.institution = 'Institution number is 3 digits.';
      if (!/^\d{5}$/.test(destination.transit)) errors.transit = 'Transit number is 5 digits.';
      if (!/^\d+$/.test(destination.account)) errors.account = 'Enter the account number.';
      return errors;
    }
  }
}

export function cadReference(destination: CadDestination): string {
  switch (destination.method) {
    case 'email':
      return destination.email.trim();
    case 'phone':
      return destination.phone.trim();
    case 'eft':
      return `${destination.institution}:${destination.transit}:${destination.account}`;
  }
}

export function validateNgn(destination: NgnDestination): DestinationErrors {
  const errors: DestinationErrors = {};
  if (!destination.bankCode.trim()) errors.bankCode = 'Enter the bank code.';
  if (!destination.accountNumber.trim()) errors.accountNumber = 'Enter the account number.';
  return errors;
}

export function ngnReference(destination: NgnDestination): string {
  return `${destination.bankCode.trim()}:${destination.accountNumber.trim()}`;
}

/** Human description of a stored `destinationReference`, for the status screen. */
export function describeDestination(currencyCode: string, reference: string | null): string | null {
  if (!reference) return null;
  if (currencyCode === 'CAD') {
    if (EFT_PATTERN.test(reference)) {
      const [institution, transit, account = ''] = reference.split(/[:|;-]/);
      return `Bank transfer (EFT) · ${institution}-${transit} · account ending ${account.slice(-4)}`;
    }
    return `Interac e-Transfer to ${reference}`;
  }
  if (currencyCode === 'NGN') {
    const [bankCode, accountNumber = ''] = reference.split(/[:|;]/);
    return `Bank ${bankCode} · account ending ${accountNumber.slice(-4)}`;
  }
  return reference;
}
